import http from "node:http";
import type { AddressInfo } from "node:net";
import zlib from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkUrl, isPublicAddress, safeFetch } from "@/lib/unfurl/safe-fetch";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // carrier-grade NAT
    "0.0.0.0",
    "255.255.255.255",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "2002:7f00:1::", // 6to4 wrapping 127.0.0.1
    "64:ff9b::7f00:1", // NAT64 wrapping 127.0.0.1
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  );
});

describe("checkUrl", () => {
  it.each(["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi", "not a url"])(
    "rejects %s",
    (u) => expect(() => checkUrl(u)).toThrow(),
  );
  it.each(["http://example.com:8080/", "https://example.com:22/", "https://user:pw@example.com/"])("rejects %s", (u) =>
    expect(() => checkUrl(u)).toThrow(),
  );
  it.each(["https://example.com/a?b=1", "http://example.com:80/", "https://example.com:443/"])("accepts %s", (u) =>
    expect(checkUrl(u).toString()).toBeTruthy(),
  );
});

describe("safeFetch with the real address checks", () => {
  it.each(["http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data/", "http://localhost/"])(
    "refuses %s",
    async (u) => {
      await expect(safeFetch(u)).rejects.toThrow(/isn't allowed/);
    },
  );

  it("refuses a public-looking hostname that resolves to a private address (DNS rebinding)", async () => {
    const resolve = async () => [{ address: "127.0.0.1", family: 4 }];
    await expect(safeFetch("http://shop.example.com/", { resolve })).rejects.toThrow(/isn't allowed/);
  });

  it("refuses a host with mixed public and private records", async () => {
    const resolve = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ];
    await expect(safeFetch("http://shop.example.com/", { resolve })).rejects.toThrow(/isn't allowed/);
  });
});

// A local test server. Tests point a fake public hostname at it and loosen the
// address check, so redirect, size, and time limits can be exercised.
describe("safeFetch limits", () => {
  let server: http.Server;
  let port = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = req.url ?? "/";
      if (path.startsWith("/redirect/")) {
        const n = Number(path.split("/")[2]);
        res.writeHead(302, { Location: n > 0 ? `/redirect/${n - 1}` : "/page" });
        return res.end();
      }
      if (path === "/to-private") {
        res.writeHead(302, { Location: "http://10.0.0.1/admin" });
        return res.end();
      }
      if (path === "/to-ftp") {
        res.writeHead(302, { Location: "ftp://shop.test/x" });
        return res.end();
      }
      if (path === "/huge") {
        res.writeHead(200, { "Content-Type": "text/html" });
        const chunk = Buffer.alloc(64 * 1024, "a");
        let sent = 0;
        const pump = () => {
          while (sent < 10 * 1024 * 1024) {
            sent += chunk.length;
            if (!res.write(chunk)) return res.once("drain", pump);
          }
          res.end();
        };
        res.write('<meta property="og:title" content="Big page">');
        return pump();
      }
      if (path === "/gzip-bomb") {
        res.writeHead(200, { "Content-Type": "text/html", "Content-Encoding": "gzip" });
        return res.end(zlib.gzipSync(Buffer.alloc(20 * 1024 * 1024, "a")));
      }
      if (path === "/slow") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write("<title>slow");
        return; // never ends
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end('<meta property="og:title" content="Test product">');
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  // Map shop.test to the local server and allow only that address. The
  // server listens on a random port, so the standard-port rule is relaxed.
  const opts = () => ({
    resolve: async () => [{ address: "127.0.0.1", family: 4 }],
    isAllowedAddress: (a: string) => a === "127.0.0.1",
  });
  const url = (path: string) => `http://shop.test:${port}${path}`;

  it("follows up to 3 redirects", async () => {
    const res = await safeFetch(url("/redirect/2"), { ...opts(), allowAnyPort: true });
    expect(res.body.toString()).toContain("Test product");
    expect(res.url).toBe(url("/page"));
  });

  it("stops after 3 redirects", async () => {
    await expect(safeFetch(url("/redirect/3"), { ...opts(), allowAnyPort: true })).rejects.toThrow(/Too many redirects/);
  });

  it("re-checks every redirect target", async () => {
    await expect(safeFetch(url("/to-private"), { ...opts(), allowAnyPort: true })).rejects.toThrow(/isn't allowed/);
    await expect(safeFetch(url("/to-ftp"), { ...opts(), allowAnyPort: true })).rejects.toThrow(/Only http/);
  });

  it("stops reading at the size cap and keeps what it has", async () => {
    const res = await safeFetch(url("/huge"), { ...opts(), allowAnyPort: true, maxBytes: 256 * 1024 });
    expect(res.truncated).toBe(true);
    expect(res.body.length).toBe(256 * 1024);
    expect(res.body.toString()).toContain("Big page");
  });

  it("applies the size cap after decompression", async () => {
    const res = await safeFetch(url("/gzip-bomb"), { ...opts(), allowAnyPort: true, maxBytes: 1024 * 1024 });
    expect(res.truncated).toBe(true);
    expect(res.body.length).toBe(1024 * 1024);
  });

  it("gives up after the time limit", async () => {
    const start = Date.now();
    await expect(safeFetch(url("/slow"), { ...opts(), allowAnyPort: true, timeoutMs: 500 })).rejects.toThrow(/Timed out/);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("uses a 5 second limit, 3 redirects, and 2 MB by default", async () => {
    const mod = await import("@/lib/unfurl/safe-fetch");
    expect([mod.TIMEOUT_MS, mod.MAX_REDIRECTS, mod.MAX_BYTES]).toEqual([5000, 3, 2 * 1024 * 1024]);
  });
});
