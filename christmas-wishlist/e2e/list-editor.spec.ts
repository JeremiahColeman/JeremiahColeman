import { expect, test, type Page } from "@playwright/test";
import { addItemAs, createListAs, newPage, signUpWithLink } from "./helpers";

const itemTitles = (page: Page) => page.getByRole("region", { name: "Items" }).getByRole("heading", { level: 3 }).allTextContents();

test.describe("owner list editor", () => {
  test("add an item by typing, with price, quantity, priority, and notes", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "Typing test");
    await expect(page.getByText("Reservations are hidden from you, so your gifts stay a surprise.")).toBeVisible();

    await addItemAs(page, "Wool socks", { price: "24.99", quantity: 2, priority: "Really want", notes: "Size M" });
    const card = page.getByRole("article", { name: "Wool socks" });
    await expect(card).toContainText("$24.99 · Wants 2");
    await expect(card).toContainText("♥ Really want");
    await expect(card).toContainText("Size M");
    await expect(page.getByText("Added! ✓")).toBeVisible();
  });

  test("autofill fills empty fields from a pasted link and keeps what you typed", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "Autofill test");
    await page.route("**/api/unfurl?**", (route) =>
      route.fulfill({
        json: {
          ok: true,
          fields: {
            title: "Wooden Train Set",
            image_url: "https://cdn.example.com/train.png",
            price_cents: 3999,
            currency: "CAD",
          },
        },
      }),
    );
    // 1x1 PNG for the product picture.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await page.route("https://cdn.example.com/**", (route) => route.fulfill({ body: png, contentType: "image/png" }));
    await page.getByLabel("Name", { exact: true }).fill("Train for Leo");
    await page.getByLabel("Link to the item (optional)").fill("https://toys.example.com/train");
    await page.getByLabel("Link to the item (optional)").blur();
    await expect(page.getByText("Filled in from the link. Check it looks right.")).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Train for Leo"); // typed: kept
    await expect(page.getByLabel("Price (optional)")).toHaveValue("39.99");
    await expect(page.getByLabel("Currency")).toHaveValue("CAD");
    await expect(page.getByAltText("Picture of the item")).toHaveAttribute("src", "https://cdn.example.com/train.png");

    await page.getByRole("button", { name: "Add to list" }).click();
    const card = page.getByRole("article", { name: "Train for Leo" });
    await expect(card).toContainText("CA$39.99");
    await expect(card.getByRole("link", { name: "View at toys.example.com ↗" })).toHaveAttribute(
      "href",
      "https://toys.example.com/train",
    );
  });

  test("when a store can't be read, you can still type the details", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "Fallback test");
    // Real request to the app's unfurl route: .invalid never resolves.
    await page.getByLabel("Link to the item (optional)").fill("https://shop.invalid/item/9");
    await page.getByLabel("Link to the item (optional)").blur();
    await expect(page.getByText("That store didn't share its details. Type them below.")).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("Mystery gadget");
    await page.getByRole("button", { name: "Add to list" }).click();
    await expect(page.getByRole("article", { name: "Mystery gadget" })).toContainText("View at shop.invalid");
  });

  test("the unfurl API needs sign-in and refuses private addresses", async ({ page, request }) => {
    const signedOut = await request.get("/api/unfurl?url=https://example.com", { maxRedirects: 0 });
    expect(signedOut.status()).toBe(401);

    await signUpWithLink(page, "Alice");
    for (const target of ["http://127.0.0.1:54321/rest/v1/", "http://169.254.169.254/latest/meta-data/", "http://localhost:3000/"]) {
      const res = await page.request.get(`/api/unfurl?url=${encodeURIComponent(target)}`);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.fields).toEqual({});
    }
    const ftp = await page.request.get(`/api/unfurl?url=${encodeURIComponent("file:///etc/passwd")}`);
    expect(ftp.status()).toBe(400);
  });

  test("edit, reorder, remove, and put back items", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "Edit test");
    await addItemAs(page, "Scarf");
    await addItemAs(page, "Mittens");
    await addItemAs(page, "Hat");
    expect(await itemTitles(page)).toEqual(["Scarf", "Mittens", "Hat"]);

    await page.getByRole("button", { name: "Move Hat up" }).click();
    await expect.poll(() => itemTitles(page)).toEqual(["Scarf", "Hat", "Mittens"]);
    await page.getByRole("button", { name: "Move Scarf down" }).click();
    await expect.poll(() => itemTitles(page)).toEqual(["Hat", "Scarf", "Mittens"]);
    // The first item's "up" button is hidden (kept in place so buttons line up).
    await expect(page.getByRole("button", { name: "Move Hat up" })).toBeHidden();

    await page.getByRole("button", { name: "Edit Scarf" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Red scarf");
    await page.getByLabel("Price (optional)").fill("15");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("article", { name: "Red scarf" })).toContainText("$15.00");

    await page.getByRole("button", { name: "Remove Mittens" }).click();
    await expect.poll(() => itemTitles(page)).toEqual(["Hat", "Red scarf"]);
    await page.getByText("Removed items (1)").click();
    await page.getByRole("button", { name: "Put back Mittens" }).click();
    await expect.poll(() => itemTitles(page)).toEqual(["Hat", "Red scarf", "Mittens"]);
  });

  test("buyers see items read-only, without removed ones", async ({ page, browser }) => {
    await signUpWithLink(page, "Alice");
    const invite = await createListAs(page, "Read-only test");
    await addItemAs(page, "Book", { price: "12" });
    await addItemAs(page, "Puzzle");
    await page.getByRole("button", { name: "Remove Puzzle" }).click();
    await expect(page.getByText("Removed items (1)")).toBeVisible();

    const bob = await newPage(browser);
    await signUpWithLink(bob, "Bob");
    await bob.goto(invite);
    await expect(bob.getByRole("article", { name: "Book" })).toContainText("$12.00");
    await expect(bob.getByRole("article", { name: "Puzzle" })).toHaveCount(0);
    await expect(bob.getByRole("button", { name: /Edit|Remove|Move/ })).toHaveCount(0);
    await expect(bob.getByText("Invite family")).toHaveCount(0);
  });

  test("new invite link, members, and removing someone", async ({ page, browser }) => {
    await signUpWithLink(page, "Alice");
    const oldInvite = await createListAs(page, "Sharing test");
    await expect(page.getByText("No one has joined yet.")).toBeVisible();

    const bob = await newPage(browser);
    await signUpWithLink(bob, "Bob");
    await bob.goto(oldInvite);
    await expect(bob.getByRole("heading", { name: "Sharing test" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Who can see this list (1)" })).toBeVisible();
    await expect(page.getByText("Bob", { exact: true })).toBeVisible();

    // Make a new link: the old one stops working for newcomers.
    await page.getByRole("button", { name: "Make a new link" }).click();
    await page.getByRole("button", { name: "Yes, make a new link" }).click();
    await expect(page.getByLabel("Invite link")).not.toHaveValue(oldInvite);
    const newInvite = await page.getByLabel("Invite link").inputValue();

    const cara = await newPage(browser);
    await signUpWithLink(cara, "Cara");
    await cara.goto(oldInvite);
    await expect(cara.getByRole("heading", { name: "This invite link isn't working" })).toBeVisible();
    await cara.goto(newInvite);
    await expect(cara.getByRole("heading", { name: "Sharing test" })).toBeVisible();

    // Remove Bob: he can't open the list anymore.
    await page.reload();
    await page.getByRole("button", { name: "Remove Bob from this list" }).click();
    await page.getByRole("button", { name: "Yes, remove" }).click();
    await expect(page.getByRole("heading", { name: "Who can see this list (1)" })).toBeVisible();
    await bob.reload();
    await expect(bob.getByRole("heading", { name: "This list isn't available" })).toBeVisible();
  });

  test("edit details, archive, and delete a list", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await createListAs(page, "Settings test", { forName: "Rex" });
    await expect(page.getByText("Reservations are hidden from you")).toHaveCount(0);

    // Scope to the settings card: Next keeps the hidden My lists page (with its
    // own "List name" field) mounted for instant back navigation.
    const settings = page.getByRole("region", { name: "List settings" });
    await settings.getByRole("button", { name: "Edit name, description, or date" }).click();
    await settings.getByLabel("List name").fill("Rex's stocking");
    await settings.getByLabel("Who is it for?").fill("Rex the dog");
    await settings.getByLabel("Description (optional)").fill("Squeaky things, please.");
    await settings.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rex's stocking", level: 1 })).toBeVisible();
    await expect(page.getByText("For Rex the dog", { exact: true })).toBeVisible();
    await expect(page.getByText("Squeaky things, please.")).toBeVisible();

    await page.getByRole("button", { name: "Archive list" }).click();
    await page.getByRole("button", { name: "Yes, archive it" }).click();
    await expect(page.getByText("This list is archived.")).toBeVisible();
    await page.getByRole("button", { name: "Unarchive list" }).click();
    await expect(page.getByText("This list is archived.")).toHaveCount(0);

    await page.getByRole("button", { name: "Delete list" }).click();
    await page.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page).toHaveURL(/\/lists$/);
    await expect(page.getByRole("link", { name: /Rex's stocking/ })).toHaveCount(0);
  });
});
