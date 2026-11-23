import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemCard, type ItemView } from "@/components/item-card";
import { Card, Notice, PageTitle } from "@/components/ui";
import { requestOrigin, requireProfile } from "@/lib/auth";
import { formatDate, recipientOf } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ListSettings } from "./list-settings";
import { AddItem, OwnerItem, RemovedItems } from "./owner-items";
import { MembersCard, ShareCard } from "./sharing";

export const metadata: Metadata = { title: "List" };

const ITEM_COLUMNS =
  "id, title, url, image_url, price_cents, currency, notes, priority, quantity_wanted, sort_order, removed_at";

export default async function ListPage({ params, searchParams }: PageProps<"/lists/[id]">) {
  const { id } = await params;
  const ownInvite = (await searchParams)["own-invite"] === "1";
  const { user } = await requireProfile(`/lists/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: list }, { data: items }] = await Promise.all([
    supabase
      .from("lists")
      .select(
        "id, title, description, event_date, recipient_is_owner, recipient_name, invite_token, owner_id, archived_at, owner:profiles!lists_owner_id_fkey(display_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    // Items carry no claim data. RLS shows members only items that aren't removed.
    supabase
      .from("items")
      .select(ITEM_COLUMNS)
      .eq("list_id", id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);
  if (!list) notFound();

  const isOwner = list.owner_id === user.id;
  const recipient = recipientOf(list);
  const live = (items ?? []).filter((i) => !i.removed_at) as ItemView[];
  const removed = (items ?? []).filter((i) => i.removed_at) as ItemView[];

  const sub = [
    isOwner ? (list.recipient_is_owner ? "Your list" : `For ${recipient}`) : `${recipient}'s list`,
    !isOwner && !list.recipient_is_owner ? `shared by ${list.owner?.display_name}` : null,
    list.event_date ? formatDate(list.event_date) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const header = (
    <>
      <PageTitle sub={sub}>{list.title}</PageTitle>
      {list.archived_at ? (
        <div className="mb-4">
          <Notice>This list is archived.</Notice>
        </div>
      ) : null}
      {list.description ? <p className="mb-6 whitespace-pre-line">{list.description}</p> : null}
    </>
  );

  if (!isOwner) {
    return (
      <>
        {header}
        <div className="space-y-4">
          {live.length === 0 ? (
            <Card>
              <p className="text-muted">Nothing on this list yet. Check back soon.</p>
            </Card>
          ) : (
            live.map((item) => <ItemCard key={item.id} item={item} />)
          )}
        </div>
      </>
    );
  }

  const { data: memberRows } = await supabase
    .from("list_members")
    .select("user_id, joined_at, profile:profiles!list_members_user_id_fkey(display_name)")
    .eq("list_id", id)
    .order("joined_at", { ascending: true });
  const members = (memberRows ?? []).map((m) => ({ user_id: m.user_id, display_name: m.profile?.display_name ?? "" }));

  return (
    <>
      {header}
      <div className="space-y-6">
        {ownInvite ? (
          <Notice tone="success">That&apos;s the invite link for your own list. Send it to family so they can join.</Notice>
        ) : null}
        {list.recipient_is_owner ? (
          <Notice>Reservations are hidden from you, so your gifts stay a surprise.</Notice>
        ) : null}

        <AddItem listId={list.id} startOpen={live.length === 0} />

        {live.length ? (
          <section aria-label="Items" className="space-y-4">
            {live.map((item, i) => (
              <OwnerItem key={item.id} listId={list.id} item={item} isFirst={i === 0} isLast={i === live.length - 1} />
            ))}
          </section>
        ) : null}

        <RemovedItems listId={list.id} items={removed} />
        <ShareCard listId={list.id} title={list.title} inviteUrl={`${await requestOrigin()}/join/${list.invite_token}`} />
        <MembersCard listId={list.id} members={members} />
        <ListSettings list={list} />
      </div>
    </>
  );
}
