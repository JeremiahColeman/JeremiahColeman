import { expect, test } from "@playwright/test";
import { addItemAs, createListAs, newPage, signUpWithLink } from "./helpers";

test.describe("installable app", () => {
  test("manifest and icons are valid", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest).toMatchObject({
      name: "Family Wishlist",
      short_name: "Wishlist",
      start_url: "/lists",
      display: "standalone",
      theme_color: "#1f5135",
    });
    const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192/any", "512x512/any", "512x512/maskable"]));
    for (const icon of manifest.icons) {
      const img = await request.get(icon.src);
      expect(img.ok()).toBe(true);
      expect(img.headers()["content-type"]).toBe("image/png");
    }
    expect((await request.get("/apple-icon.png")).ok()).toBe(true);
  });

  test("pages link the manifest and iPhone home-screen settings", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#1f5135");
    await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]')).not.toHaveCount(0);
  });

  test("offline: a friendly page, and no list data in the cache", async ({ page, context }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "Offline test");
    await addItemAs(page, "Secret gift idea");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    // The worker controls pages after it activates; reload to come under it.
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    await page.goto("/shared").catch(() => {});
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await context.setOffline(false);
    // Wait until the browser is really back online, then tap "Try again".
    await expect.poll(() => page.evaluate(() => fetch("/manifest.webmanifest").then((r) => r.ok, () => false))).toBe(true);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Shared with me" })).toBeVisible();

    // Only the offline page and an icon are cached: nothing personal.
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) urls.push(new URL(req.url).pathname);
      }
      return urls.sort();
    });
    expect(cached).toEqual(["/icons/icon-192.png", "/offline.html"]);
  });

  test("Account shows home-screen steps for iPhone", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await page.goto("/account");
    const card = page.getByRole("region", { name: "Add it to your home screen" });
    await expect(card).toContainText("Tap the Share button");
    await expect(card).toContainText("Add to Home Screen");
  });

  test("the security policy blocks nothing the app needs", async ({ page, browser }) => {
    const violations: string[] = [];
    const watch = (p: import("@playwright/test").Page) =>
      p.on("console", (msg) => {
        if (/Content Security Policy|Refused to (connect|load|execute|frame)/i.test(msg.text())) violations.push(msg.text());
      });
    watch(page);
    await signUpWithLink(page, "Alice");
    const invite = await createListAs(page, "CSP test");
    await addItemAs(page, "Mug");
    const bob = await newPage(browser);
    watch(bob);
    await signUpWithLink(bob, "Bob");
    await bob.goto(invite);
    await bob.getByRole("article", { name: "Mug" }).getByRole("button", { name: "Reserve Mug" }).click();
    await expect(bob.getByRole("article", { name: "Mug" }).getByTestId("my-claim")).toBeVisible();
    await bob.goto("/shopping");
    await expect(bob.getByTestId("total-reserved")).toBeVisible();
    // Realtime (a websocket to Supabase) must still connect under the policy.
    await bob.goto(invite);
    await page.reload();
    await addItemAs(page, "Teapot");
    await expect(bob.getByRole("article", { name: "Teapot" })).toBeVisible();
    expect(violations).toEqual([]);
  });
});
