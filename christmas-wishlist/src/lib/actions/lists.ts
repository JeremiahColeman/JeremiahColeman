"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ListFormState = {
  error?: string;
  values?: Record<string, string>;
};

export async function createList(_prev: ListFormState, formData: FormData): Promise<ListFormState> {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const values = {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    event_date: String(formData.get("event_date") ?? "").trim(),
    for_someone_else: formData.get("for_someone_else") === "on" ? "on" : "",
    recipient_name: String(formData.get("recipient_name") ?? "").trim(),
  };
  if (!values.title) return { error: "Give your list a name.", values };
  if (values.title.length > 120) return { error: "Please keep the name under 120 characters.", values };
  if (values.event_date && !/^\d{4}-\d{2}-\d{2}$/.test(values.event_date)) {
    return { error: "That date doesn't look right.", values };
  }
  const forSomeoneElse = values.for_someone_else === "on";
  if (forSomeoneElse && !values.recipient_name) return { error: "Who is this list for?", values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lists")
    .insert({
      owner_id: user.id,
      title: values.title,
      description: values.description || null,
      event_date: values.event_date || null,
      recipient_is_owner: !forSomeoneElse,
      recipient_name: forSomeoneElse ? values.recipient_name : null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "We couldn't create the list. Please try again.", values };
  redirect(`/lists/${data.id}`);
}
