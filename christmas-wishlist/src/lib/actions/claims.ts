"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Claims are written as the signed-in user. The database decides who may
// claim (members, or the owner of a managed list) and prevents overclaiming.

export type ClaimResult = { error?: string; ok?: boolean };

const UUID = /^[0-9a-f-]{36}$/i;

function friendly(error: { message?: string; code?: string }): string {
  const left = error.message?.match(/Only (\d+) left/);
  if (left) {
    const n = Number(left[1]);
    return n === 0
      ? "Someone else just reserved the rest of this. The list has been updated."
      : `Someone else just reserved some of this. Only ${n} left now.`;
  }
  if (error.code === "23505") return "You've already reserved this one.";
  if (error.code === "42501") return "You can't reserve this item.";
  return "That didn't work. Please try again.";
}

function quantity(value: FormDataEntryValue | null) {
  const n = Number(value ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}

async function client() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return { user, supabase: await createClient() };
}

export async function createClaim(listId: string, itemId: string, formData: FormData): Promise<ClaimResult> {
  if (!UUID.test(listId) || !UUID.test(itemId)) return { error: "Item not found." };
  const qty = quantity(formData.get("quantity"));
  if (!qty) return { error: "Pick how many." };
  const status = formData.get("status") === "purchased" ? "purchased" : "reserved";

  const { user, supabase } = await client();
  const { error } = await supabase
    .from("claims")
    .insert({ item_id: itemId, claimer_id: user.id, quantity: qty, status });
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/shopping");
  return error ? { error: friendly(error) } : { ok: true };
}

export async function updateClaim(listId: string, claimId: string, formData: FormData): Promise<ClaimResult> {
  if (!UUID.test(listId) || !UUID.test(claimId)) return { error: "Reservation not found." };
  const update: { quantity?: number; status?: "reserved" | "purchased" } = {};
  if (formData.has("quantity")) {
    const qty = quantity(formData.get("quantity"));
    if (!qty) return { error: "Pick how many." };
    update.quantity = qty;
  }
  const status = formData.get("status");
  if (status === "reserved" || status === "purchased") update.status = status;

  const { supabase } = await client();
  const { data, error } = await supabase.from("claims").update(update).eq("id", claimId).select("id");
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/shopping");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "That reservation is gone. The list has been updated." };
  return { ok: true };
}

export async function deleteClaim(listId: string, claimId: string): Promise<ClaimResult> {
  if (!UUID.test(listId) || !UUID.test(claimId)) return { error: "Reservation not found." };
  const { supabase } = await client();
  const { error } = await supabase.from("claims").delete().eq("id", claimId);
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/shopping");
  return error ? { error: friendly(error) } : { ok: true };
}
