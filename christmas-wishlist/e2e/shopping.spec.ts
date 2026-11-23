import { expect, test, type Page } from "@playwright/test";
import { addItemAs, createListAs, newPage, signUpWithLink } from "./helpers";

const card = (page: Page, title: string) => page.getByRole("article", { name: title });

test.describe("My shopping", () => {
  test("lists your claims by recipient, with totals and actions", async ({ page, browser }) => {
    await signUpWithLink(page, "Alice");
    const aliceInvite = await createListAs(page, "Alice's Christmas");
    await addItemAs(page, "Scarf", { price: "20" });
    await addItemAs(page, "Socks", { price: "5", quantity: 3 });
    await addItemAs(page, "Book");
    const rexInvite = await createListAs(page, "Rex's stocking", { forName: "Rex" });
    await addItemAs(page, "Squeaky toy", { price: "8.50" });

    const bob = await newPage(browser);
    await signUpWithLink(bob, "Bob");
    await bob.goto(aliceInvite);
    await card(bob, "Scarf").getByRole("button", { name: "Reserve Scarf" }).click();
    await expect(card(bob, "Scarf").getByTestId("my-claim")).toBeVisible();
    await card(bob, "Socks").getByRole("button", { name: "One more" }).click();
    await card(bob, "Socks").getByRole("button", { name: "Reserve Socks" }).click();
    await expect(card(bob, "Socks").getByTestId("my-claim")).toBeVisible();
    await card(bob, "Book").getByRole("button", { name: "I already bought it" }).click();
    await expect(card(bob, "Book").getByTestId("my-claim")).toHaveText("✓ You bought this");
    await bob.goto(rexInvite);
    await card(bob, "Squeaky toy").getByRole("button", { name: "Reserve Squeaky toy" }).click();
    await expect(card(bob, "Squeaky toy").getByTestId("my-claim")).toBeVisible();

    await bob.getByRole("link", { name: "Shopping" }).click();
    await expect(bob.getByRole("heading", { name: "For Alice" })).toBeVisible();
    await expect(bob.getByRole("heading", { name: "For Rex" })).toBeVisible();
    // $20 + 2 × $5 + $8.50 still to buy; the book has no price.
    await expect(bob.getByTestId("total-reserved")).toHaveText("$38.50");
    await expect(bob.getByTestId("total-purchased")).toHaveText("$0.00");
    await expect(bob.getByText("1 without a price")).toBeVisible();
    await expect(card(bob, "Socks")).toContainText("$10.00 (2 × $5.00)");

    // Mark the scarf as bought: totals move.
    await card(bob, "Scarf").getByRole("button", { name: "Mark as purchased" }).click();
    await expect(bob.getByTestId("total-purchased")).toHaveText("$20.00");
    await expect(bob.getByTestId("total-reserved")).toHaveText("$18.50");

    // "Share my name" exists only where there will be a gift reveal, and sticks.
    const share = card(bob, "Scarf").getByLabel(/Share my name for thank-you notes/);
    await expect(share).not.toBeChecked();
    await share.check();
    await expect(share).toBeChecked();
    await bob.reload();
    await expect(card(bob, "Scarf").getByLabel(/Share my name/)).toBeChecked();
    await expect(card(bob, "Squeaky toy").getByLabel(/Share my name/)).toHaveCount(0);

    // Unreserve from here.
    await card(bob, "Socks").getByRole("button", { name: "Unreserve Socks" }).click();
    await card(bob, "Socks").getByRole("button", { name: "Yes, remove it" }).click();
    await expect(card(bob, "Socks")).toHaveCount(0);
    await expect(bob.getByTestId("total-reserved")).toHaveText("$8.50");
  });

  test("flags items the owner changed or removed after you reserved them", async ({ page, browser }) => {
    await signUpWithLink(page, "Alice");
    const invite = await createListAs(page, "Flags");
    await addItemAs(page, "Lamp", { price: "30" });
    await addItemAs(page, "Vase");
    await addItemAs(page, "Pen");

    const bob = await newPage(browser);
    await signUpWithLink(bob, "Bob");
    await bob.goto(invite);
    for (const t of ["Lamp", "Vase", "Pen"]) {
      await card(bob, t).getByRole("button", { name: `Reserve ${t}` }).click();
      await expect(card(bob, t).getByTestId("my-claim")).toBeVisible();
    }

    // Alice edits the lamp's price, removes the vase, and reorders the pen.
    await page.reload();
    await page.getByRole("button", { name: "Edit Lamp" }).click();
    await page.getByLabel("Price (optional)").fill("45");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(card(page, "Lamp")).toContainText("$45.00");
    await page.getByRole("button", { name: "Remove Vase" }).click();
    await expect(page.getByText("Removed items (1)")).toBeVisible();
    await page.getByRole("button", { name: "Move Pen up" }).click();

    await bob.goto("/shopping");
    await expect(card(bob, "Lamp")).toContainText("The details changed after you reserved it.");
    await expect(card(bob, "Lamp")).toContainText("$45.00");
    await expect(card(bob, "Vase")).toContainText("Alice removed this from their list.");
    await expect(card(bob, "Vase").getByRole("button", { name: "Mark as purchased" })).toHaveCount(0);
    await expect(card(bob, "Pen")).not.toContainText(/changed|removed/);
    await expect(bob.getByText("2 items need a look")).toBeVisible();

    await card(bob, "Vase").getByRole("button", { name: "Remove Vase" }).click();
    await card(bob, "Vase").getByRole("button", { name: "Yes, remove it" }).click();
    await expect(card(bob, "Vase")).toHaveCount(0);
  });

  test("empty state points to shared lists", async ({ page }) => {
    await signUpWithLink(page, "Dan");
    await page.goto("/shopping");
    await expect(page.getByText("You haven't reserved anything yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See shared lists" })).toBeVisible();
  });
});
