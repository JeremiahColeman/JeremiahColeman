/**
 * Claim status as buyers see it: counts only, never who. Shared by the buyer
 * view and the managed-list owner view. Never used on a list where the owner
 * is the recipient.
 */

export type Totals = { item_id: string; reserved_qty: number; purchased_qty: number; updated_at: string };
export type MyClaim = { id: string; item_id: string; quantity: number; status: "reserved" | "purchased" };

export type ItemStatus = {
  kind: "available" | "partial" | "reserved" | "purchased";
  label: string;
  taken: number;
  left: number;
};

export function itemStatus(totals: Pick<Totals, "reserved_qty" | "purchased_qty"> | undefined, wanted: number): ItemStatus {
  const reserved = totals?.reserved_qty ?? 0;
  const purchased = totals?.purchased_qty ?? 0;
  const taken = reserved + purchased;
  const left = Math.max(wanted - taken, 0);
  if (taken === 0) return { kind: "available", label: "Available", taken, left };
  if (taken < wanted) return { kind: "partial", label: `${taken} of ${wanted} taken`, taken, left };
  // Fully taken. "Purchased" only once everything taken is bought.
  if (purchased >= wanted) return { kind: "purchased", label: "Purchased", taken, left };
  return { kind: "reserved", label: "Reserved", taken, left };
}

/** Picks the newer of two totals rows (server render vs. a live update). */
export function newerTotals(a: Totals | undefined, b: Totals | undefined) {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b.updated_at) > Date.parse(a.updated_at) ? b : a;
}
