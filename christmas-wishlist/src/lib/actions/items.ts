"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePriceToCents } from "@/lib/unfurl/parse";

// All writes run as the signed-in user; RLS allows them only for the list owner.

export type ItemFormState = { error?: string; ok?: boolean; nonce?: number };

const UUID = /^[0-9a-f-]{36}$/i;

/** Adds https:// to "example.com/thing"; returns null for anything that isn't a web link. */
function normalizeUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type ItemFields = {
  title: string;
  url: string | null;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  notes: string | null;
  priority: number;
  quantity_wanted: number;
};

function readItemForm(formData: FormData): { fields?: ItemFields; error?: string } {
  const title = String(formData.get("title") ?? "").replace(/\s+/g, " ").trim();
  if (!title) return { error: "Give the item a name." };
  if (title.length > 300) return { error: "Please keep the name under 300 characters." };

  const rawUrl = String(formData.get("url") ?? "");
  const url = normalizeUrl(rawUrl);
  if (rawUrl.trim() && !url) return { error: "That link doesn't look right. It should start with https://" };

  const rawImage = String(formData.get("image_url") ?? "");
  const image_url = normalizeUrl(rawImage);

  const rawPrice = String(formData.get("price") ?? "").trim();
  const price_cents = rawPrice ? parsePriceToCents(rawPrice) : undefined;
  if (rawPrice && price_cents === undefined) return { error: "Enter the price as a number, like 24.99." };

  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Pick a currency." };

  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 2000) return { error: "Please keep notes under 2,000 characters." };

  const priority = Number(formData.get("priority") ?? 2);
  const quantity_wanted = Number(formData.get("quantity_wanted") ?? 1);
  if (!Number.isInteger(quantity_wanted) || quantity_wanted < 1 || quantity_wanted > 99) {
    return { error: "How many? Pick a number from 1 to 99." };
  }

  return {
    fields: {
      title,
      url,
      image_url,
      price_cents: price_cents ?? null,
      currency,
      notes: notes || null,
      priority: [1, 2, 3].includes(priority) ? priority : 2,
      quantity_wanted,
    },
  };
}

async function signedInClient() {
  if (!(await getUser())) redirect("/sign-in");
  return createClient();
}

export async function addItem(listId: string, _prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  if (!UUID.test(listId)) return { error: "List not found." };
  const { fields, error } = readItemForm(formData);
  if (!fields) return { error };

  const supabase = await signedInClient();
  const { data: last } = await supabase
    .from("items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { error: dbError } = await supabase
    .from("items")
    .insert({ ...fields, list_id: listId, sort_order: (last?.sort_order ?? 0) + 1 });
  if (dbError) return { error: "We couldn't add that item. Please try again." };

  revalidatePath(`/lists/${listId}`);
  return { ok: true, nonce: Date.now() };
}

export async function updateItem(
  listId: string,
  itemId: string,
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  if (!UUID.test(listId) || !UUID.test(itemId)) return { error: "Item not found." };
  const { fields, error } = readItemForm(formData);
  if (!fields) return { error };

  const supabase = await signedInClient();
  const { data, error: dbError } = await supabase
    .from("items")
    .update(fields)
    .eq("id", itemId)
    .eq("list_id", listId)
    .select("id");
  if (dbError || !data?.length) return { error: "We couldn't save your changes. Please try again." };

  revalidatePath(`/lists/${listId}`);
  return { ok: true, nonce: Date.now() };
}

/** Moves an item one place up or down, then renumbers the list 1..n. */
export async function moveItem(formData: FormData) {
  const listId = String(formData.get("list_id"));
  const itemId = String(formData.get("item_id"));
  const direction = formData.get("direction") === "up" ? -1 : 1;
  if (!UUID.test(listId) || !UUID.test(itemId)) return;

  const supabase = await signedInClient();
  const { data: items } = await supabase
    .from("items")
    .select("id, sort_order")
    .eq("list_id", listId)
    .is("removed_at", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (!items) return;

  const from = items.findIndex((i) => i.id === itemId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return;
  [items[from], items[to]] = [items[to], items[from]];

  // Reordering doesn't change items.updated_at (see the items_guard trigger),
  // so buyers' "edited after you claimed it" flags aren't affected.
  await Promise.all(
    items.map((item, index) =>
      item.sort_order === index + 1
        ? null
        : supabase.from("items").update({ sort_order: index + 1 }).eq("id", item.id).eq("list_id", listId),
    ),
  );
  revalidatePath(`/lists/${listId}`);
}

export async function setItemRemoved(formData: FormData) {
  const listId = String(formData.get("list_id"));
  const itemId = String(formData.get("item_id"));
  const removed = formData.get("removed") === "1";
  if (!UUID.test(listId) || !UUID.test(itemId)) return;

  const supabase = await signedInClient();
  await supabase
    .from("items")
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("list_id", listId);
  revalidatePath(`/lists/${listId}`);
}

// ---------------------------------------------------------------------------
// List-level actions
// ---------------------------------------------------------------------------

export type ListDetailsState = { error?: string; ok?: boolean; nonce?: number };

export async function updateListDetails(
  listId: string,
  _prev: ListDetailsState,
  formData: FormData,
): Promise<ListDetailsState> {
  if (!UUID.test(listId)) return { error: "List not found." };
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const recipientName = formData.get("recipient_name");
  if (!title) return { error: "Give your list a name." };
  if (title.length > 120) return { error: "Please keep the name under 120 characters." };
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { error: "That date doesn't look right." };

  const update: { title: string; description: string | null; event_date: string | null; recipient_name?: string } = {
    title,
    description: description || null,
    event_date: eventDate || null,
  };
  if (recipientName !== null) {
    const name = String(recipientName).trim();
    if (!name) return { error: "Who is this list for?" };
    update.recipient_name = name;
  }

  const supabase = await signedInClient();
  const { data, error } = await supabase.from("lists").update(update).eq("id", listId).select("id");
  if (error || !data?.length) return { error: "We couldn't save the list. Please try again." };
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
  return { ok: true, nonce: Date.now() };
}

export async function setListArchived(formData: FormData) {
  const listId = String(formData.get("list_id"));
  if (!UUID.test(listId)) return;
  const archived = formData.get("archived") === "1";
  const supabase = await signedInClient();
  await supabase
    .from("lists")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", listId);
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
}

export async function deleteList(formData: FormData) {
  const listId = String(formData.get("list_id"));
  if (!UUID.test(listId)) return;
  const supabase = await signedInClient();
  await supabase.from("lists").delete().eq("id", listId);
  revalidatePath("/lists");
  redirect("/lists");
}

export async function rotateInviteLink(formData: FormData) {
  const listId = String(formData.get("list_id"));
  if (!UUID.test(listId)) return;
  const supabase = await signedInClient();
  await supabase.rpc("rotate_invite_token", { p_list_id: listId });
  revalidatePath(`/lists/${listId}`);
}

export async function removeMember(formData: FormData) {
  const listId = String(formData.get("list_id"));
  const userId = String(formData.get("user_id"));
  if (!UUID.test(listId) || !UUID.test(userId)) return;
  const supabase = await signedInClient();
  await supabase.from("list_members").delete().eq("list_id", listId).eq("user_id", userId);
  revalidatePath(`/lists/${listId}`);
}
