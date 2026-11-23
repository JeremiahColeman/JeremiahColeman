import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, Notice, PageTitle } from "@/components/ui";
import { ShareLink } from "@/components/share-link";
import { requestOrigin, requireProfile } from "@/lib/auth";
import { formatDate, recipientOf } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "List" };

export default async function ListPage({ params, searchParams }: PageProps<"/lists/[id]">) {
  const { id } = await params;
  const ownInvite = (await searchParams)["own-invite"] === "1";
  const { user } = await requireProfile(`/lists/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: list } = await supabase
    .from("lists")
    .select(
      "id, title, description, event_date, recipient_is_owner, recipient_name, invite_token, owner_id, owner:profiles!lists_owner_id_fkey(display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const isOwner = list.owner_id === user.id;
  const recipient = recipientOf(list);
  const sub = [
    isOwner ? (list.recipient_is_owner ? "Your list" : `For ${recipient}`) : `${recipient}'s list`,
    !isOwner && !list.recipient_is_owner ? `shared by ${list.owner?.display_name}` : null,
    list.event_date ? formatDate(list.event_date) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageTitle sub={sub}>{list.title}</PageTitle>
      <div className="space-y-6">
        {list.description ? <p className="whitespace-pre-line">{list.description}</p> : null}

        {isOwner && ownInvite ? (
          <Notice tone="success">That&apos;s the invite link for your own list. Send it to family so they can join.</Notice>
        ) : null}

        {isOwner && list.recipient_is_owner ? (
          <Notice>Reservations are hidden from you, so your gifts stay a surprise.</Notice>
        ) : null}

        {isOwner ? (
          <Card className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold">Invite family</h2>
              <p className="mt-1 text-muted">Anyone with this link can see the list after they sign in.</p>
            </div>
            <ShareLink url={`${await requestOrigin()}/join/${list.invite_token}`} title={list.title} />
          </Card>
        ) : null}

        <Card>
          <p className="text-muted">Items will appear here.</p>
        </Card>
      </div>
    </>
  );
}
