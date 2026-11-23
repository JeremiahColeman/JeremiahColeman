import { describe, expect, it } from "vitest";
import { decodeBody, parsePriceToCents, parseProductPage } from "@/lib/unfurl/parse";

const BASE = "https://shop.example.com/p/123";

describe("parsePriceToCents", () => {
  it.each([
    ["19.99", 1999],
    ["$1,299.99", 129999],
    ["1.299,99", 129999],
    ["19,99", 1999],
    ["1,299", 129900],
    ["24", 2400],
    [24, 2400],
    [19.995, 2000],
    ["£ 7.5", 750],
  ])("%s → %s", (input, cents) => expect(parsePriceToCents(input)).toBe(cents));

  it.each([["free"], [""], [null], [-5], ["99999999999"]])("rejects %s", (input) =>
    expect(parsePriceToCents(input)).toBeUndefined(),
  );
});

describe("parseProductPage", () => {
  it("reads Open Graph and product price tags, in any attribute order", () => {
    const html = `<html><head>
      <meta content="Cozy Wool Socks &amp; Slippers" property="og:title">
      <meta property='og:image' content='/img/socks.jpg'/>
      <meta property="product:price:amount" content="24.50">
      <meta property="product:price:currency" content="usd">
      <title>Ignored title</title></head></html>`;
    expect(parseProductPage(html, BASE)).toEqual({
      title: "Cozy Wool Socks & Slippers",
      image_url: "https://shop.example.com/img/socks.jpg",
      price_cents: 2450,
      currency: "USD",
    });
  });

  it("reads a JSON-LD Product inside @graph with an AggregateOffer", () => {
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Page" },
        {
          "@type": ["Product"],
          name: "Wooden Train Set",
          image: [{ "@type": "ImageObject", url: "https://cdn.example.com/train.png" }],
          offers: { "@type": "AggregateOffer", lowPrice: "39.00", priceCurrency: "CAD" },
        },
      ],
    };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script><title>Shop</title>`;
    expect(parseProductPage(html, BASE)).toEqual({
      title: "Wooden Train Set",
      image_url: "https://cdn.example.com/train.png",
      price_cents: 3900,
      currency: "CAD",
    });
  });

  it("uses JSON-LD offers for price when OG has only title and image", () => {
    const html = `
      <meta property="og:title" content="Headphones">
      <meta property="og:image" content="https://cdn.example.com/h.jpg">
      <script type="application/ld+json">[{"@type":"Product","name":"HP-1","offers":[{"@type":"Offer","priceSpecification":{"price":129.95,"priceCurrency":"EUR"}}]}]</script>`;
    expect(parseProductPage(html, BASE)).toEqual({
      title: "Headphones",
      image_url: "https://cdn.example.com/h.jpg",
      price_cents: 12995,
      currency: "EUR",
    });
  });

  it("returns partial results and skips broken JSON-LD", () => {
    const html = `<script type="application/ld+json">{not json</script><title> Just a   title </title>`;
    expect(parseProductPage(html, BASE)).toEqual({ title: "Just a title" });
  });

  it("returns nothing for an empty page", () => {
    expect(parseProductPage("<html></html>", BASE)).toEqual({});
  });

  it("ignores non-http image URLs", () => {
    const html = `<meta property="og:image" content="javascript:alert(1)"><meta property="og:title" content="X">`;
    expect(parseProductPage(html, BASE)).toEqual({ title: "X" });
  });

  it("decodes numeric entities and the declared charset", () => {
    const latin1 = Buffer.from(`<meta charset="iso-8859-1"><title>Cr\xe8me &#8211; br&#xFB;l&eacute;e</title>`, "latin1");
    const html = decodeBody(latin1, "text/html");
    expect(parseProductPage(html, BASE).title).toBe("Crème – brûlée");
  });
});
