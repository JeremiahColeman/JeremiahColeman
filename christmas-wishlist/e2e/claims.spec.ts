import { expect, test, type Page } from "@playwright/test";
import { addItemAs, createListAs, newPage, signUpWithLink } from "./helpers";

const card = (page: Page, title: string) => page.getByRole("article", { name: title });
const chip = (page: Page, title: string) => card(page, title).getByTestId("status-chip");

async function setUpList(page: Page, browser: import("@playwright/test").Browser, opts: { forName?: string } = {}) {
  await signUpWithLink(page, "Alice");
  const invite = await createListAs(page, opts.forName ? "Rex's stocking" : "Alice's Christmas", opts);
  await addItemAs(page, "Scarf");
  await addItemAs(page, "Socks", { quantity: 3 });
  const bob = await newPage(browser);
  await signUpWithLink(bob, "Bob");
  await bob.goto(invite);
  const cara = await newPage(browser);
  await signUpWithLink(cara, "Cara");
  await cara.goto(invite);
  return { invite, bob, cara };
}

test.describe("reserving gifts", () => {
  test("a reservation shows up live for other buyers, without names", async ({ page, browser }) => {
    const { bob, cara } = await setUpList(page, browser);
    await expect(chip(cara, "Scarf")).toHaveText("✓ Available");

    await card(bob, "Scarf").getByRole("button", { name: "Reserve Scarf" }).click();
    await expect(card(bob, "Scarf").getByTestId("my-claim")).toHaveText("★ You reserved this");
    await expect(chip(bob, "Scarf")).toHaveText("Reserved");

    // Cara's page updates by itself (Realtime), and never names Bob.
    await expect(chip(cara, "Scarf")).toHaveText("Reserved");
    await expect(card(cara, "Scarf")).toContainText("Someone already reserved this.");
    await expect(card(cara, "Scarf").getByRole("button", { name: /Reserve/ })).toHaveCount(0);
    await expect(cara.getByRole("main")).not.toContainText("Bob");

    await card(bob, "Scarf").getByRole("button", { name: "Mark as purchased" }).click();
    await expect(card(bob, "Scarf").getByTestId("my-claim")).toHaveText("✓ You bought this");
    await expect(chip(cara, "Scarf")).toHaveText("Purchased");
    await expect(card(cara, "Scarf")).toContainText("Someone already bought this.");

    await card(bob, "Scarf").getByRole("button", { name: "Unreserve" }).click();
    await card(bob, "Scarf").getByRole("button", { name: "Yes, unreserve" }).click();
    await expect(chip(bob, "Scarf")).toHaveText("✓ Available");
    await expect(chip(cara, "Scarf")).toHaveText("✓ Available");
  });

  test("quantities: '2 of 3 taken', filling up, and changing how many", async ({ page, browser }) => {
    const { bob, cara } = await setUpList(page, browser);

    await card(bob, "Socks").getByRole("button", { name: "One more" }).click();
    await card(bob, "Socks").getByRole("button", { name: "Reserve Socks" }).click();
    await expect(card(bob, "Socks").getByTestId("my-claim")).toHaveText("★ You reserved this (2)");
    await expect(chip(cara, "Socks")).toHaveText("2 of 3 taken");

    // Only one left for Cara.
    await expect(card(cara, "Socks").getByRole("button", { name: "One more" })).toHaveCount(0);
    await card(cara, "Socks").getByRole("button", { name: "Reserve Socks" }).click();
    await expect(chip(cara, "Socks")).toHaveText("Reserved");
    await expect(chip(bob, "Socks")).toHaveText("Reserved");

    // Bob can lower his share, but not raise it past what's left.
    await card(bob, "Socks").getByRole("button", { name: "Change amount" }).click();
    await expect(card(bob, "Socks").getByText("Up to 2 available for you.")).toBeVisible();
    await card(bob, "Socks").getByRole("button", { name: "One fewer" }).click();
    await card(bob, "Socks").getByRole("button", { name: "Save" }).click();
    await expect(card(bob, "Socks").getByTestId("my-claim")).toHaveText("★ You reserved this");
    await expect(chip(cara, "Socks")).toHaveText("2 of 3 taken");
  });

  test("the owner sees no claim information on their own list, even live", async ({ page, browser }) => {
    const { bob } = await setUpList(page, browser);
    // Alice is looking at her list while Bob reserves.
    await card(bob, "Scarf").getByRole("button", { name: "Reserve Scarf" }).click();
    await card(bob, "Socks").getByRole("button", { name: "Reserve Socks" }).click();
    await expect(chip(bob, "Socks")).toHaveText("1 of 3 taken");

    await page.waitForTimeout(1500);
    for (const p of [page, await page.reload().then(() => page)]) {
      await expect(p.getByRole("heading", { name: "Scarf" })).toBeVisible();
      await expect(p.getByTestId("status-chip")).toHaveCount(0);
      await expect(p.getByTestId("my-claim")).toHaveCount(0);
      // (Bob and Cara do appear under "Who can see this list", which is fine.)
      await expect(p.getByRole("region", { name: "Items" })).not.toContainText(/Reserv|Available|taken|bought|Bob|Cara/);
      await expect(p.getByText("Reservations are hidden from you, so your gifts stay a surprise.")).toBeVisible();
    }
    // Nothing about claims in the HTML the owner's browser receives.
    const html = await page.content();
    expect(html).not.toMatch(/reserved_qty|purchased_qty|claimer|status-chip/);
  });

  test("on a managed list, the owner sees statuses and can reserve, but never names", async ({ page, browser }) => {
    const { bob } = await setUpList(page, browser, { forName: "Rex" });
    await expect(page.getByText("You made this list for Rex")).toBeVisible();
    await expect(chip(page, "Scarf")).toHaveText("✓ Available");

    await card(bob, "Scarf").getByRole("button", { name: "Reserve Scarf" }).click();
    await expect(chip(page, "Scarf")).toHaveText("Reserved"); // live
    await expect(card(page, "Scarf")).toContainText("Someone already reserved this.");
    // Bob is listed under "Who can see this list", but never next to an item.
    await expect(page.getByRole("region", { name: "Items" })).not.toContainText(/Bob|Cara/);

    await card(page, "Socks").getByRole("button", { name: "Reserve Socks" }).click();
    await expect(card(page, "Socks").getByTestId("my-claim")).toHaveText("★ You reserved this");
    await expect(chip(bob, "Socks")).toHaveText("1 of 3 taken");
    // The owner still has the editor controls.
    await expect(page.getByRole("button", { name: "Edit Socks" })).toBeVisible();
  });

  test("if someone else got there first, you get a plain message", async ({ page, browser }) => {
    const { bob, cara } = await setUpList(page, browser);
    // Cut Cara's live updates so her page goes stale.
    await cara.routeWebSocket(/realtime/, () => {});
    await cara.reload();
    await expect(chip(cara, "Scarf")).toHaveText("✓ Available");

    await card(bob, "Scarf").getByRole("button", { name: "Reserve Scarf" }).click();
    await expect(chip(bob, "Scarf")).toHaveText("Reserved");

    await card(cara, "Scarf").getByRole("button", { name: "Reserve Scarf" }).click();
    await expect(card(cara, "Scarf")).toContainText("Someone else just reserved the rest of this.");
    await expect(chip(cara, "Scarf")).toHaveText("Reserved");
  });

  test("a new item from the owner appears for buyers without reloading", async ({ page, browser }) => {
    const { cara } = await setUpList(page, browser);
    await expect(card(cara, "Socks")).toBeVisible();
    await addItemAs(page, "Mittens");
    await expect(card(cara, "Mittens")).toBeVisible();
    await expect(chip(cara, "Mittens")).toHaveText("✓ Available");
  });
});
