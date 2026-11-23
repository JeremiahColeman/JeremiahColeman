import { devices, expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const MAILPIT = "http://127.0.0.1:54324";

export const newEmail = (name: string) => `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`;

type Mail = { link: string; code: string };

/** Waits for the newest sign-in email to `email` in the local Mailpit inbox. */
export async function latestSignInEmail(email: string, after = 0): Promise<Mail> {
  for (let i = 0; i < 50; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=5`);
    const { messages = [] } = (await res.json()) as { messages?: { ID: string; Created: string }[] };
    const fresh = messages.filter((m) => new Date(m.Created).getTime() > after);
    if (fresh.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json()) as { HTML: string };
      const link = msg.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
      const code = msg.HTML.match(/>\s*(\d{6})\s*</)?.[1];
      if (link && code) return { link, code };
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No sign-in email for ${email}`);
}

/** Requests a sign-in email from the sign-in page that's already open. */
export async function requestEmail(page: Page, email: string) {
  const sentAt = Date.now() - 100;
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  return latestSignInEmail(email, sentAt);
}

/** Full new-user sign-in through the magic link, including the welcome step. */
export async function signUpWithLink(page: Page, name: string, email = newEmail(name)) {
  await page.goto("/sign-in");
  const mail = await requestEmail(page, email);
  await page.goto(mail.link);
  await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  return email;
}

/** A second person on their own phone (separate cookies). */
export async function newPage(browser: Browser) {
  const iPhone = { ...devices["iPhone 13"], defaultBrowserType: undefined };
  const context = await browser.newContext({ ...iPhone, baseURL: "http://localhost:3000" });
  return context.newPage();
}
