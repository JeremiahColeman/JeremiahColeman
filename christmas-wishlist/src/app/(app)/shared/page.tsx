import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatDate, recipientOf } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shared with me" };

export default async function SharedPage() {
  const { user } = await requireProfile("/shared");
  const supabase = await createClient();
  // RLS returns only lists you own or joined; drop the ones you own.
  const { data: lists } = await supabase
    .from("lists")
    .select(
      "id, title, event_date, recipient_is_owner, recipient_name, archived_at, owner:profiles!lists_owner_id_fkey(display_name)",
    )
    .neq("owner_id", user.id)
    .order("event_date", { ascending: true, nullsFirst: false });

  const groups = new Map<string, NonNullable<typeof lists>>();
  for (const list of lists ?? []) {
    const who = recipientOf(list) || "Someone";
    groups.set(who, [...(groups.get(who) ?? []), list]);
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <PageTitle sub="Lists family members shared with you, by who they're for.">Shared with me</PageTitle>
      {sorted.length === 0 ? (
        <Card>
          <p>Nothing here yet.</p>
          <p className="mt-2 text-muted">When someone sends you an invite link, open it and their list shows up here.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {sorted.map(([who, group]) => (
            <section key={who} aria-labelledby={`group-${who}`}>
              <h2 id={`group-${who}`} className="mb-3 font-display text-2xl font-bold">
                {who}
              </h2>
              <div className="space-y-3">
                {group.map((list) => (
                  <Link key={list.id} href={`/lists/${list.id}`} className="block">
                    <Card className={`transition-colors hover:border-pine ${list.archived_at ? "opacity-70" : ""}`}>
                      <h3 className="text-xl font-bold">{list.title}</h3>
                      <p className="mt-1 text-muted">
                        {list.recipient_is_owner ? null : `Shared by ${list.owner?.display_name}`}
                        {!list.recipient_is_owner && list.event_date ? " · " : null}
                        {list.event_date ? formatDate(list.event_date) : null}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
