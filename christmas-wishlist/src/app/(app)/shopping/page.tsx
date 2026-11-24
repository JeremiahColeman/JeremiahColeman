import type { Metadata } from "next";
import { ButtonLink, Card, PageTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ShoppingItem, type ShoppingRow } from "./shopping-item";

export const metadata: Metadata = { title: "My shopping" };

type Sums = Map<string, { reserved: number; purchased: number }>;

function addTo(sums: Sums, row: ShoppingRow) {
  if (row.price_cents == null) return;
  const s = sums.get(row.currency) ?? { reserved: 0, purchased: 0 };
  s[row.status] += row.price_cents * row.quantity;
  sums.set(row.currency, s);
}

function money(sums: Sums, key: "reserved" | "purchased") {
  const parts = [...sums.entries()].filter(([, s]) => s[key] > 0).map(([cur, s]) => formatPrice(s[key], cur));
  return parts.length ? parts.join(" + ") : formatPrice(0, "USD");
}

export default async function ShoppingPage() {
  await requireProfile("/shopping");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_shopping");
  const rows = (data ?? []) as ShoppingRow[];

  const all: Sums = new Map();
  const groups = new Map<string, { rows: ShoppingRow[]; sums: Sums }>();
  for (const row of rows) {
    addTo(all, row);
    const g = groups.get(row.recipient_name) ?? { rows: [] as ShoppingRow[], sums: new Map() as Sums };
    g.rows.push(row);
    addTo(g.sums, row);
    groups.set(row.recipient_name, g);
  }
  const unpriced = rows.filter((r) => r.price_cents == null).length;
  const needsAttention = rows.filter((r) => r.item_removed || (r.item_edited && !r.item_removed)).length;

  return (
    <>
      <PageTitle sub="Everything you've reserved or bought, in one place.">My shopping</PageTitle>
      {rows.length === 0 ? (
        <Card className="space-y-4">
          <p>You haven&apos;t reserved anything yet.</p>
          <p className="text-muted">Open a list someone shared with you and tap Reserve on a gift.</p>
          <ButtonLink href="/shared" className="w-full">
            See shared lists
          </ButtonLink>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card className="grid grid-cols-2 gap-4" role="group" aria-label="Totals">
            <div>
              <p className="text-base text-muted">Still to buy</p>
              <p className="text-2xl font-bold" data-testid="total-reserved">
                {money(all, "reserved")}
              </p>
            </div>
            <div>
              <p className="text-base text-muted">Bought</p>
              <p className="text-2xl font-bold" data-testid="total-purchased">
                {money(all, "purchased")}
              </p>
            </div>
            {unpriced || needsAttention ? (
              <p className="col-span-2 text-base text-muted">
                {[
                  needsAttention ? `${needsAttention} ${needsAttention === 1 ? "item needs" : "items need"} a look` : null,
                  unpriced ? `${unpriced} without a price` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </Card>

          {[...groups.entries()].map(([who, g]) => (
            <section key={who} aria-labelledby={`for-${who}`} className="space-y-3">
              <div>
                <h2 id={`for-${who}`} className="font-display text-2xl font-bold">
                  For {who}
                </h2>
                <p className="text-base text-muted">
                  {[...g.sums.values()].some((s) => s.reserved + s.purchased > 0)
                    ? `${money(g.sums, "reserved")} to buy · ${money(g.sums, "purchased")} bought`
                    : null}
                </p>
              </div>
              {g.rows.map((row) => (
                <ShoppingItem key={row.claim_id} row={row} />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
