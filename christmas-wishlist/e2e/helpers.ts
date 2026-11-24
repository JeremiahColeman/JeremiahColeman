import { devices, expect, type Browser, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";

const MAILPIT = "http://127.0.0.1:54324";

export const newEmail = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 8)}@example.test`;

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

/** Creates a list from My lists and waits for its page. Returns the invite link. */
export async function createListAs(page: Page, title: string, opts: { forName?: string; date?: string } = {}) {
  await page.goto("/lists");
  // Wait for the page (it streams in), then open the form if it's closed.
  const open = page.getByRole("button", { name: "+ Create a list" });
  const form = page.getByRole("heading", { name: "New list" });
  await expect(open.or(form)).toBeVisible();
  if (await open.isVisible()) await open.click();
  await page.getByLabel("List name").fill(title);
  if (opts.date) await page.getByLabel("Event date (optional)").fill(opts.date);
  if (opts.forName) {
    await page.getByLabel("This list is for someone else").check();
    await page.getByLabel("Who is it for?").fill(opts.forName);
  }
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  return page.getByLabel("Invite link").inputValue();
}

/** Adds an item by typing (no link). Opens the add form if needed. */
export async function addItemAs(
  page: Page,
  title: string,
  opts: { price?: string; quantity?: number; priority?: "Really want" | "Would like" | "Nice to have"; notes?: string } = {},
) {
  // Wait for the page (it streams in), then open the form if it's closed.
  const open = page.getByRole("button", { name: "+ Add an item" });
  const form = page.getByRole("heading", { name: "Add an item" });
  await expect(open.or(form)).toBeVisible();
  if (await open.isVisible()) await open.click();
  await page.getByLabel("Name", { exact: true }).fill(title);
  if (opts.price) await page.getByLabel("Price (optional)").fill(opts.price);
  for (let q = 1; q < (opts.quantity ?? 1); q++) await page.getByRole("button", { name: "One more" }).click();
  if (opts.priority) await page.getByText(opts.priority, { exact: true }).click();
  if (opts.notes) await page.getByLabel("Notes (optional)").fill(opts.notes);
  await page.getByRole("button", { name: "Add to list" }).click();
  await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
}

/** Local database URL from `supabase status` (tests only). */
function dbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return (process.env.SUPABASE_DB_URL = out.match(/^DB_URL="?(.*?)"?$/m)![1]);
}

/**
 * Simulates time passing: sets a list's event date, and when it was set,
 * directly in the local database (the app's trigger would stamp "now").
 */
export async function setEventDate(listId: string, eventDate: string, setAt: string) {
  const db = new pg.Client({ connectionString: dbUrl() });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local session_replication_role = replica");
    await db.query("update public.lists set event_date = $2, event_date_set_at = $3 where id = $1", [listId, eventDate, setAt]);
    await db.query("commit");
  } finally {
    await db.end();
  }
}

export const listIdFrom = (page: Page) => page.url().match(/\/lists\/([0-9a-f-]{36})/)![1];

export function daysFromToday(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
