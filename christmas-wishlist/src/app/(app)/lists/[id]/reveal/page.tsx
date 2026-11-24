import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemImage } from "@/components/item-image";
import { Card, PageTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { revealState } from "@/lib/reveal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gift reveal" };

export default async function RevealPage({ params }: PageProps<"/lists/[id]/reveal">) {
  const { id } = await params;
  const { user } = await requireProfile(`/lists/${id}/reveal`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: list } = await supabase
    .from("lists")
    .select("id, title, owner_id, event_date, event_date_set_at, recipient_is_owner")
    .eq("id", id)
    .maybeSingle();
  if (!list || list.owner_id !== user.id) notFound();

  const back = (
    <Link href={`/lists/${id}`} className="mb-4 inline-flex min-h-11 items-center font-semibold text-pine underline">
      ← Back to {list.title}
    </Link>
  );

  const state = revealState(list);
  if (state.kind !== "open") {
    return (
      <>
        {back}
        <PageTitle>Gift reveal</PageTitle>
        <Card>
          <p>
            {state.kind === "waiting"
              ? `Not yet! The gift reveal opens on ${formatDate(state.opensOn)}.`
              : "The gift reveal isn't available for this list."}
          </p>
        </Card>
      </>
    );
  }

  // The database checks again: owner only, own-recipient lists, after the date.
  const { data, error } = await supabase.rpc("get_gift_reveal", { p_list_id: id });
  const gifts = data ?? [];

  return (
    <>
      {back}
      <PageTitle sub={`${list.title} · ${formatDate(list.event_date)}`}>Your gifts 🎁</PageTitle>
      {error ? (
        <Card>
          <p>The gift reveal isn&apos;t available right now. Please try again later.</p>
        </Card>
      ) : gifts.length === 0 ? (
        <Card>
          <p>No one marked a gift from this list as bought.</p>
          <p className="mt-2 text-muted">Some people forget to tap “Mark as purchased”, so you may still be surprised!</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <p>
            {gifts.length} {gifts.length === 1 ? "gift was" : "gifts were"} marked as bought. Names appear only for
            people who chose to share them for thank-you notes.
          </p>
          {gifts.map((g) => (
            <article key={g.item_id} aria-labelledby={`gift-${g.item_id}`} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex gap-4">
                <ItemImage src={g.image_url} className="size-16" />
                <div className="min-w-0 flex-1">
                  <h2 id={`gift-${g.item_id}`} className="text-lg font-bold break-words">
                    {g.title}
                  </h2>
                  <p className="text-muted">
                    {[g.purchased_qty > 1 ? `${g.purchased_qty} bought` : null, formatPrice(g.price_cents, g.currency)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 font-semibold" data-testid="givers">
                    {g.givers.length ? `From ${g.givers.join(", ")}` : "From someone who kept it a surprise"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
