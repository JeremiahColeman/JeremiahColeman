import { expect, test } from "@playwright/test";
import { addItemAs, createListAs, newEmail, newPage, requestEmail, signUpWithLink } from "./helpers";

// The spec's main flow, start to finish, at an iPhone-sized viewport.
test("smoke: create a list, invite, join, reserve, and check My shopping", async ({ page, browser }) => {
  await signUpWithLink(page, "Grandma Jo");
  const invite = await createListAs(page, "Grandma's Christmas", { date: "2026-12-25" });
  await addItemAs(page, "Reading glasses", { price: "19.99" });

  const sam = await newPage(browser);
  await sam.goto(invite);
  await expect(sam).toHaveURL(/\/sign-in/);
  await signUpWithLinkFromInvite(sam, "Sam");

  await expect(sam.getByRole("heading", { name: "Grandma's Christmas" })).toBeVisible();
  const item = sam.getByRole("article", { name: "Reading glasses" });
  await item.getByRole("button", { name: "Reserve Reading glasses" }).click();
  await expect(item.getByTestId("my-claim")).toHaveText("★ You reserved this");

  await sam.getByRole("link", { name: "Shopping" }).click();
  await expect(sam.getByRole("heading", { name: "For Grandma Jo" })).toBeVisible();
  await expect(sam.getByRole("article", { name: "Reading glasses" })).toContainText("$19.99");
  await expect(sam.getByTestId("total-reserved")).toHaveText("$19.99");

  // Grandma still sees no sign of it.
  await page.reload();
  await expect(page.getByRole("region", { name: "Items" })).not.toContainText(/Reserv|Sam/);
});

async function signUpWithLinkFromInvite(page: import("@playwright/test").Page, name: string) {
  const mail = await requestEmail(page, newEmail(name));
  await page.goto(mail.link);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
}
