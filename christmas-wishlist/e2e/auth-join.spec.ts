import { expect, test } from "@playwright/test";
import { newEmail, newPage, requestEmail, signUpWithLink } from "./helpers";

test.describe("sign in, profile, and join", () => {
  test("new user signs in with the email link, picks a name, and creates a list", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await expect(page).toHaveURL(/\/lists$/);
    await expect(page.getByText("Hi, Alice.")).toBeVisible();

    await page.getByLabel("List name").fill("Alice's Christmas");
    await page.getByLabel("Event date (optional)").fill("2026-12-25");
    await page.getByRole("button", { name: "Create list" }).click();

    await expect(page.getByRole("heading", { name: "Alice's Christmas" })).toBeVisible();
    await expect(page.getByText("Reservations are hidden from you, so your gifts stay a surprise.")).toBeVisible();
    await expect(page.getByLabel("Invite link")).toHaveValue(/\/join\/[0-9a-f]{36}$/);

    // Back on My lists, the new list shows as a card and the form is closed.
    await page.getByRole("link", { name: "My lists" }).click();
    await expect(page.getByRole("link", { name: /Alice's Christmas/ })).toContainText("For you · December 25, 2026 · 0 items");
    await expect(page.getByRole("button", { name: "+ Create a list" })).toBeVisible();
    await expect(page.getByLabel("List name")).toHaveCount(0);
  });

  test("an invited relative joins while signed out, using the 6-digit code", async ({ page, browser }) => {
    await signUpWithLink(page, "Alice");
    await page.getByLabel("List name").fill("Alice's Birthday");
    await page.getByRole("button", { name: "Create list" }).click();
    const invite = await page.getByLabel("Invite link").inputValue();

    // Bob opens the link on his own phone.
    const bob = await newPage(browser);
    await bob.goto(invite);
    await expect(bob).toHaveURL(/\/sign-in\?next=%2Fjoin%2F/);
    await expect(bob.getByText("Sign in to open the list you were invited to.")).toBeVisible();

    const bobEmail = newEmail("Bob");
    const mail = await requestEmail(bob, bobEmail);
    await bob.getByLabel("Or type the 6-digit code from the email").fill(mail.code);
    await bob.getByRole("button", { name: "Sign in" }).click();

    await expect(bob.getByRole("heading", { name: "Welcome!" })).toBeVisible();
    await bob.getByLabel("Your name").fill("Bob");
    await bob.getByRole("button", { name: "Continue" }).click();

    await expect(bob.getByRole("heading", { name: "Alice's Birthday" })).toBeVisible();
    await expect(bob.getByText("Alice's list")).toBeVisible();
    // Buyers don't get the owner's surprise note or the invite controls.
    await expect(bob.getByText("Reservations are hidden from you")).toHaveCount(0);
    await expect(bob.getByLabel("Invite link")).toHaveCount(0);

    await bob.getByRole("link", { name: "Shared" }).click();
    await expect(bob.getByRole("heading", { name: "Alice", exact: true })).toBeVisible();
    await expect(bob.getByRole("link", { name: /Alice's Birthday/ })).toBeVisible();

    // Opening the link again is harmless.
    await bob.goto(invite);
    await expect(bob.getByRole("heading", { name: "Alice's Birthday" })).toBeVisible();
  });

  test("a managed list shows who it's for", async ({ page, browser }) => {
    await signUpWithLink(page, "Alice");
    await page.getByLabel("List name").fill("Rex's stocking");
    await page.getByLabel("This list is for someone else").check();
    await page.getByLabel("Who is it for?").fill("Rex");
    await page.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByText("For Rex")).toBeVisible();
    await expect(page.getByText("Reservations are hidden from you")).toHaveCount(0);
    const invite = await page.getByLabel("Invite link").inputValue();

    const cara = await newPage(browser);
    await signUpWithLink(cara, "Cara");
    await cara.goto(invite);
    await expect(cara.getByText("Rex's list · shared by Alice")).toBeVisible();
    await cara.getByRole("link", { name: "Shared" }).click();
    await expect(cara.getByRole("heading", { name: "Rex", exact: true })).toBeVisible();
  });

  test("the owner opening their own invite link lands on their list", async ({ page }) => {
    await signUpWithLink(page, "Alice");
    await page.getByLabel("List name").fill("Own link");
    await page.getByRole("button", { name: "Create list" }).click();
    const invite = await page.getByLabel("Invite link").inputValue();
    await page.goto(invite);
    await expect(page.getByRole("heading", { name: "Own link" })).toBeVisible();
    await expect(page.getByText("That's the invite link for your own list.")).toBeVisible();
  });

  test("a bad invite link shows a friendly message", async ({ page }) => {
    await signUpWithLink(page, "Dan");
    await page.goto("/join/not-a-real-token");
    await expect(page.getByRole("heading", { name: "This invite link isn't working" })).toBeVisible();
  });

  test("signed-out visitors are sent to sign in and then back", async ({ page }) => {
    await page.goto("/shopping");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fshopping/);
    const email = newEmail("Erin");
    const mail = await requestEmail(page, email);
    await page.goto(mail.link);
    await page.getByLabel("Your name").fill("Erin");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/shopping$/);
    await expect(page.getByRole("heading", { name: "My shopping" })).toBeVisible();
  });

  test("returning users skip the welcome step; sign out works", async ({ page }) => {
    const email = await signUpWithLink(page, "Fay");
    await expect(page).toHaveURL(/\/lists$/);
    await page.getByRole("link", { name: "Account" }).click();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByLabel("Your name").fill("Aunt Fay");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.waitForTimeout(1500);
    const mail = await requestEmail(page, email);
    await page.goto(mail.link);
    await expect(page).toHaveURL(/\/lists$/);
    await expect(page.getByText("Hi, Aunt Fay.")).toBeVisible();
  });

  test("used or broken links fail safely; no open redirect", async ({ page }) => {
    const email = newEmail("Gus");
    await page.goto("/sign-in");
    const mail = await requestEmail(page, email);
    await page.goto(mail.link);
    await page.getByLabel("Your name").fill("Gus");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("link", { name: "Account" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();

    // The same link can't be used twice.
    await page.goto(mail.link);
    await expect(page.getByText("That sign-in link has expired or was already used.")).toBeVisible();

    // A wrong code is rejected with a plain message. (Wait out the local
    // one-email-per-second limit first.)
    await page.waitForTimeout(1500);
    await page.goto("/sign-in?next=//evil.example/steal");
    const fresh = await requestEmail(page, email);
    await page.getByLabel("Or type the 6-digit code from the email").fill("000000" === fresh.code ? "111111" : "000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That code didn't work.")).toBeVisible();

    // The right code signs in, and the off-site "next" is ignored.
    await page.getByLabel("Or type the 6-digit code from the email").fill(fresh.code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("http://localhost:3000/lists");
  });
});
