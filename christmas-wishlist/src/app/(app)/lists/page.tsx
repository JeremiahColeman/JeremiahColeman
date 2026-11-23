import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CreateListForm } from "./create-list-form";

export const metadata: Metadata = { title: "My lists" };

export default async function MyListsPage() {
  const { user, profile } = await requireProfile("/lists");
  const supabase = await createClient();
  const { data: lists } = await supabase
    .from("lists")
    .select("id, title, description, event_date, recipient_is_owner, recipient_name, archived_at, items(count)")
    .eq("owner_id", user.id)
    .is("items.removed_at", null)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  return (
    <>
      <PageTitle sub={`Hi, ${profile.display_name}. These are the lists you made.`}>My lists</PageTitle>
      <div className="space-y-4">
        {/* Keyed by count so the form resets (closes) after a list is created. */}
        <CreateListForm key={lists?.length ?? 0} startOpen={!lists?.length} />
        {lists?.map((list) => {
          const count = list.items[0]?.count ?? 0;
          return (
            <Link key={list.id} href={`/lists/${list.id}`} className="block">
              <Card className={`transition-colors hover:border-pine ${list.archived_at ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold">{list.title}</h2>
                  {list.archived_at ? (
                    <span className="rounded-full bg-line px-3 py-1 text-sm font-semibold">Archived</span>
                  ) : null}
                </div>
                <p className="mt-1 text-muted">
                  {list.recipient_is_owner ? "For you" : `For ${list.recipient_name}`}
                  {list.event_date ? ` · ${formatDate(list.event_date)}` : ""}
                  {` · ${count} ${count === 1 ? "item" : "items"}`}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
