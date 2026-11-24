import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import ipaddr from "ipaddr.js";

/**
 * Fetches a public web page for link autofill without letting the server be
 * used to reach private networks (SSRF):
 *
 * - http and https only, default ports only
 * - every address the host resolves to must be public unicast; the check runs
 *   inside the socket's DNS lookup, so the address that's checked is the
 *   address that's connected to (no DNS-rebinding gap)
 * - at most 3 redirects, each one re-checked
 * - 5 seconds overall, and at most 2 MB of (decompressed) body
 */

export const MAX_REDIRECTS = 3;
export const TIMEOUT_MS = 5_000;
export const MAX_BYTES = 2 * 1024 * 1024;

export class UnfurlBlockedError extends Error {}

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Override for tests only. */
  isAllowedAddress?: (address: string) => boolean;
  /** Tests only: allow a non-standard port (the local test server's). */
  allowAnyPort?: boolean;
  /** Override for tests only. */
  resolve?: (hostname: string) => Promise<{ address: string; family: number }[]>;
};

export type SafeFetchResult = {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
  truncated: boolean;
};

/** True only for globally routable unicast addresses. */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  // process() turns IPv4-mapped IPv6 (::ffff:127.0.0.1) into plain IPv4.
  const parsed = ipaddr.process(address);
  return parsed.range() === "unicast";
}

export function checkUrl(raw: string, { allowAnyPort = false } = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnfurlBlockedError("Not a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnfurlBlockedError("Only http and https links.");
  if (url.username || url.password) throw new UnfurlBlockedError("Links with passwords aren't allowed.");
  if (!allowAnyPort && url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) {
    throw new UnfurlBlockedError("Only standard web ports.");
  }
  return url;
}

const defaultResolve = (hostname: string) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true }) as Promise<{ address: string; family: number }[]>;

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const isAllowed = options.isAllowedAddress ?? isPublicAddress;
  const resolve = options.resolve ?? defaultResolve;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new UnfurlBlockedError("Timed out.")), timeoutMs);
  try {
    const portRule = { allowAnyPort: options.allowAnyPort ?? false };
    let url = checkUrl(rawUrl, portRule);
    for (let hop = 0; ; hop++) {
      const res = await requestOnce(url, { isAllowed, resolve, signal: controller.signal, maxBytes });
      if (res.redirectTo) {
        if (hop >= maxRedirects) throw new UnfurlBlockedError("Too many redirects.");
        url = checkUrl(new URL(res.redirectTo, url).toString(), portRule);
        continue;
      }
      return { ...res.result!, url: url.toString() };
    }
  } finally {
    clearTimeout(timer);
  }
}

type Hop = { redirectTo?: string; result?: Omit<SafeFetchResult, "url"> };

function requestOnce(
  url: URL,
  ctx: {
    isAllowed: (a: string) => boolean;
    resolve: NonNullable<SafeFetchOptions["resolve"]>;
    signal: AbortSignal;
    maxBytes: number;
  },
): Promise<Hop> {
  return new Promise<Hop>((resolvePromise, reject) => {
    if (ctx.signal.aborted) return reject(ctx.signal.reason);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");

    // IP literals skip DNS, so check them here.
    if (net.isIP(hostname) && !ctx.isAllowed(hostname)) {
      return reject(new UnfurlBlockedError("That address isn't allowed."));
    }

    // Node calls this with { all: true } when it tries several addresses
    // (happy eyeballs), and then expects an array back.
    const lookup = ((host: string, opts: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
      ctx
        .resolve(host)
        .then((addresses) => {
          if (!addresses.length) throw new UnfurlBlockedError("Host not found.");
          // Reject if ANY address is private, so a host can't mix public and
          // private records.
          if (addresses.some((a) => !ctx.isAllowed(a.address))) {
            throw new UnfurlBlockedError("That address isn't allowed.");
          }
          if (opts?.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        })
        .catch((err) => callback(err));
    }) as unknown as net.LookupFunction;

    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup,
        signal: ctx.signal,
        agent: false,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FamilyWishlistLinkPreview/1.0)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en-US,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolvePromise({ redirectTo: res.headers.location });
        }

        let stream: NodeJS.ReadableStream = res;
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());

        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = (truncated: boolean) => {
          if (done) return;
          done = true;
          resolvePromise({
            result: {
              status,
              contentType: String(res.headers["content-type"] ?? ""),
              body: Buffer.concat(chunks),
              truncated,
            },
          });
        };

        stream.on("data", (chunk: Buffer) => {
          if (done) return;
          const room = ctx.maxBytes - size;
          if (chunk.length >= room) {
            chunks.push(chunk.subarray(0, room));
            size += room;
            finish(true);
            req.destroy();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        stream.on("end", () => finish(false));
        stream.on("error", (err) => {
          if (!done) reject(err);
        });
      },
    );
    req.on("error", (err) => reject(ctx.signal.aborted ? ctx.signal.reason : err));
    req.end();
  });
}
