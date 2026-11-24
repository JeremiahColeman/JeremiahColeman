"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type NameState = { error?: string; saved?: boolean; value?: string; redirectTo?: string };

export async function saveDisplayName(_prev: NameState, formData: FormData): Promise<NameState> {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const value = String(formData.get("display_name") ?? "").replace(/\s+/g, " ").trim();
  if (!value) return { error: "Please enter a name.", value };
  if (value.length > 60) return { error: "Please use 60 characters or fewer.", value };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: value }).eq("id", user.id);
  if (error) return { error: "We couldn't save your name. Please try again.", value };

  revalidatePath("/", "layout");
  const next = formData.get("next");
  if (next !== null) return { saved: true, value, redirectTo: safeNext(next) };
  return { saved: true, value };
}
