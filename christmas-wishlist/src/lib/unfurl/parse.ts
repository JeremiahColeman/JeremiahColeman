/**
 * Pulls a product's title, image, and price out of a web page. Every field is
 * optional: retailers vary a lot, and the form falls back to manual entry.
 */

export type Unfurled = {
  title?: string;
  image_url?: string;
  price_cents?: number;
  currency?: string;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  trade: "™",
  reg: "®",
  copy: "©",
  eacute: "é",
  pound: "£",
  euro: "€",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

function clean(text: unknown, max = 300): string | undefined {
  if (typeof text !== "string") return undefined;
  const out = decodeEntities(text).replace(/\s+/g, " ").trim();
  return out ? out.slice(0, max) : undefined;
}

function parseAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/<>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const m of tag.matchAll(re)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return attrs;
}

/** Meta tags keyed by property/name (lowercased). First value wins. */
function metaTags(html: string) {
  const metas = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop)?.toLowerCase();
    if (key && a.content !== undefined && !metas.has(key)) metas.set(key, a.content);
  }
  return metas;
}

/** "1,299.99" → 129999; "19,99" → 1999; 24 → 2400. */
export function parsePriceToCents(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : undefined;
  if (typeof value !== "string") return undefined;
  let s = value.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return undefined;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever separator comes last is the decimal point.
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    // "19,99" is a decimal; "1,299" is thousands.
    s = /,\d{1,2}$/.test(s) && s.split(",").length === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, ""); // "1.299.000"
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return undefined;
  return Math.round(n * 100);
}

function cleanCurrency(value: unknown) {
  if (typeof value !== "string") return undefined;
  const c = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : undefined;
}

function absoluteHttpUrl(value: unknown, base: string) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

type Json = unknown;
const asArray = (v: Json): Json[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const isObject = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);

function hasType(node: Record<string, Json>, type: string) {
  return asArray(node["@type"]).some((t) => typeof t === "string" && (t === type || t.endsWith(`/${type}`)));
}

/** Finds Product nodes anywhere in JSON-LD (top level, arrays, @graph, nested). */
function findProducts(node: Json, out: Record<string, Json>[] = [], depth = 0): Record<string, Json>[] {
  if (depth > 8) return out;
  for (const item of asArray(node)) {
    if (!isObject(item)) continue;
    if (hasType(item, "Product") || hasType(item, "ProductGroup")) out.push(item);
    for (const key of ["@graph", "mainEntity", "itemListElement", "item", "hasVariant"]) {
      if (key in item) findProducts(item[key], out, depth + 1);
    }
  }
  return out;
}

function offerPrice(offers: Json): { cents?: number; currency?: string } {
  for (const offer of asArray(offers)) {
    if (!isObject(offer)) continue;
    const spec = asArray(offer.priceSpecification).find(isObject);
    const cents =
      parsePriceToCents(offer.price) ??
      parsePriceToCents(offer.lowPrice) ??
      (spec ? parsePriceToCents(spec.price) : undefined);
    const currency = cleanCurrency(offer.priceCurrency) ?? (spec ? cleanCurrency(spec.priceCurrency) : undefined);
    if (cents !== undefined) return { cents, currency };
    if (offer.offers) {
      const nested = offerPrice(offer.offers);
      if (nested.cents !== undefined) return nested;
    }
  }
  return {};
}

function jsonLdProduct(html: string, baseUrl: string): Unfurled {
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of scripts) {
    let data: Json;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const product of findProducts(data)) {
      const image = asArray(product.image)
        .map((img) => (isObject(img) ? (img.url ?? img.contentUrl) : img))
        .map((img) => absoluteHttpUrl(img, baseUrl))
        .find(Boolean);
      const { cents, currency } = offerPrice(product.offers);
      const result: Unfurled = { title: clean(product.name), image_url: image, price_cents: cents, currency };
      if (result.title || result.price_cents !== undefined) return result;
    }
  }
  return {};
}

export function parseProductPage(html: string, baseUrl: string): Unfurled {
  const meta = metaTags(html);
  const ld = jsonLdProduct(html, baseUrl);
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const result: Unfurled = {
    title: clean(meta.get("og:title")) ?? ld.title ?? clean(meta.get("twitter:title")) ?? clean(titleTag),
    image_url:
      absoluteHttpUrl(meta.get("og:image:secure_url"), baseUrl) ??
      absoluteHttpUrl(meta.get("og:image"), baseUrl) ??
      absoluteHttpUrl(meta.get("og:image:url"), baseUrl) ??
      ld.image_url ??
      absoluteHttpUrl(meta.get("twitter:image"), baseUrl),
    price_cents:
      parsePriceToCents(meta.get("product:price:amount")) ??
      parsePriceToCents(meta.get("og:price:amount")) ??
      ld.price_cents,
    currency:
      cleanCurrency(meta.get("product:price:currency")) ?? cleanCurrency(meta.get("og:price:currency")) ?? ld.currency,
  };
  // Drop empty fields so callers can tell "found" from "not found".
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v !== undefined)) as Unfurled;
}

/** Decodes a response body using the charset from Content-Type or a <meta charset>. */
export function decodeBody(body: Buffer, contentType: string) {
  const fromHeader = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  const head = body.subarray(0, 4096).toString("latin1");
  const fromMeta = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(body);
    } catch {
      // Unknown label: try the next one.
    }
  }
  return body.toString("utf8");
}
