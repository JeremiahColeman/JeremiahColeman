import { expect, test, type Page } from "@playwright/test";
import { addItemAs, createListAs, daysFromToday, listIdFrom, newPage, setEventDate, signUpWithLink } from "./helpers";

const card = (page: Page, title: string) => page.getByRole("article", { name: title });

test.describe("gift reveal", () => {
  test("opens after the event date and names only givers who opted in", async ({ page, browser }) => {
    await signUpWithLink(page, "Alice");
    const invite = await createListAs(page, "Birthday", { date: daysFromToday(10) });
    const listId = listIdFrom(page);
    await addItemAs(page, "Headphones");
    await addItemAs(page, "Candle", { quantity: 2 });
    await addItemAs(page, "Puzzle");

    // Before the date: a friendly "not yet".
    await expect(page.getByRole("region", { name: "🎁 Gift reveal" })).toContainText("you can see which gifts were bought");
    await page.goto(`/lists/${listId}/reveal`);
    await expect(page.getByText(/Not yet! The gift reveal opens on/)).toBeVisible();

    const bob = await newPage(browser);
    await signUpWithLink(bob, "Bob");
    await bob.goto(invite);
    await card(bob, "Headphones").getByRole("button", { name: "I already bought it" }).click();
    await expect(card(bob, "Headphones").getByTestId("my-claim")).toBeVisible();
    await card(bob, "Candle").getByRole("button", { name: "I already bought it" }).click();
    await expect(card(bob, "Candle").getByTestId("my-claim")).toBeVisible();
    await card(bob, "Puzzle").getByRole("button", { name: "Reserve Puzzle" }).click(); // reserved only
    await expect(card(bob, "Puzzle").getByTestId("my-claim")).toBeVisible();
    await bob.goto("/shopping");
    await card(bob, "Headphones").getByLabel(/Share my name/).check();
    await expect(card(bob, "Headphones").getByLabel(/Share my name/)).toBeChecked();

    const cara = await newPage(browser);
    await signUpWithLink(cara, "Cara");
    await cara.goto(invite);
    await card(cara, "Candle").getByRole("button", { name: "I already bought it" }).click();
    await expect(card(cara, "Candle").getByTestId("my-claim")).toBeVisible();

    // A buyer can't open the reveal.
    await bob.goto(`/lists/${listId}/reveal`);
    await expect(bob.getByRole("heading", { name: "This list isn't available" })).toBeVisible();

    // Time passes: the date (set 20 days ago) was yesterday.
    await setEventDate(listId, daysFromToday(-1), new Date(Date.now() - 20 * 864e5).toISOString());
    await page.goto(`/lists/${listId}`);
    await page.getByRole("link", { name: "Open the gift reveal" }).click();
    await expect(page.getByRole("heading", { name: "Your gifts 🎁" })).toBeVisible();
    await expect(page.getByText("2 gifts were marked as bought.")).toBeVisible();
    await expect(card(page, "Headphones").getByTestId("givers")).toHaveText("From Bob");
    await expect(card(page, "Candle").getByTestId("givers")).toHaveText("From someone who kept it a surprise");
    await expect(card(page, "Candle")).toContainText("2 bought");
    await expect(card(page, "Puzzle")).toHaveCount(0);
    // Cara didn't opt in, so her name appears on no gift. (The previous list
    // page, with its members list, stays mounted but hidden, so check the
    // visible gift cards rather than the whole page.)
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByRole("article").filter({ hasText: "Cara" })).toHaveCount(0);
  });

  test("moving the date into the past doesn't open it early", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "Peek attempt", { date: daysFromToday(10) });
    const settings = page.getByRole("region", { name: "List settings" });
    await settings.getByRole("button", { name: "Edit name, description, or date" }).click();
    await settings.getByLabel("Event date (optional)").fill(daysFromToday(-1));
    await settings.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("region", { name: "🎁 Gift reveal" })).toContainText("changed after it had passed");
    await page.goto(`/lists/${listIdFrom(page)}/reveal`);
    await expect(page.getByText("The gift reveal isn't available for this list.")).toBeVisible();
  });

  test("lists without a date, and managed lists, explain themselves", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "No date");
    await expect(page.getByRole("region", { name: "🎁 Gift reveal" })).toContainText("Add an event date");
    await createListAs(page, "For Rex", { forName: "Rex", date: daysFromToday(5) });
    await expect(page.getByRole("region", { name: "🎁 Gift reveal" })).toHaveCount(0);
  });
});
