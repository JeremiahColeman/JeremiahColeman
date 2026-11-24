import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * /join/[token]: signs you in if needed, asks for your name if it's your
 * first visit, joins the list, and opens it.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/join/[token]">) {
  const { token } = await params;
  const origin = request.nextUrl.origin;
  const here = `/join/${encodeURIComponent(token)}`;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return go(`/sign-in?next=${encodeURIComponent(here)}`);

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
  if (!profile?.display_name) return go(`/welcome?next=${encodeURIComponent(here)}`);

  const { data: listId, error } = await supabase.rpc("join_list", { p_invite_token: token });
  if (!error && listId) return go(`/lists/${listId}`);

  // The owner opening their own link: just take them to the list.
  const { data: own } = await supabase
    .from("lists")
    .select("id")
    .eq("invite_token", token)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (own) return go(`/lists/${own.id}?own-invite=1`);

  return go("/invite-invalid");
}
