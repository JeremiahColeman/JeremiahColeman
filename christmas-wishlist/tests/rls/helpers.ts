import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import pg from "pg";

export const url = () => process.env.SUPABASE_URL!;
export const anonKey = () => process.env.SUPABASE_ANON_KEY!;

const noSession = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  // Realtime can be slow to attach right after `supabase start` or `db reset`.
  realtime: { timeout: 30_000 },
};

/** Service-role client. Test setup only (creating auth users). Never used to read claims. */
export function adminClient() {
  return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, noSession);
}

export function anonClient() {
  return createClient(url(), anonKey(), noSession);
}

export type TestUser = {
  id: string;
  name: string;
  email: string;
  token: string;
  client: SupabaseClient;
};

export async function createUser(name: string): Promise<TestUser> {
  const email = `${name.toLowerCase().replace(/\W+/g, "-")}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `pw-${randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;

  const client = anonClient();
  const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const token = session.session!.access_token;
  client.realtime.setAuth(token);
  return { id: data.user.id, name, email, token, client };
}

/** Direct Postgres access, used only to simulate time passing in reveal tests. */
export async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export function isoDate(offsetDays: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function createList(
  owner: TestUser,
  fields: { title: string; event_date?: string | null; recipient_is_owner?: boolean; recipient_name?: string },
) {
  return must(
    await owner.client
      .from("lists")
      .insert({ owner_id: owner.id, ...fields })
      .select("id, invite_token")
      .single(),
  ) as { id: string; invite_token: string };
}

export async function addItem(owner: TestUser, listId: string, title: string, quantity_wanted = 1) {
  return must(
    await owner.client
      .from("items")
      .insert({ list_id: listId, title, quantity_wanted, price_cents: 1999 })
      .select("id, updated_at")
      .single(),
  ) as { id: string; updated_at: string };
}

export async function join(user: TestUser, token: string) {
  return must(await user.client.rpc("join_list", { p_invite_token: token })) as string;
}

export async function claim(
  user: TestUser,
  itemId: string,
  quantity = 1,
  status: "reserved" | "purchased" = "reserved",
  share = false,
) {
  return user.client
    .from("claims")
    .insert({ item_id: itemId, claimer_id: user.id, quantity, status, share_name_with_recipient: share })
    .select("id")
    .single();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
