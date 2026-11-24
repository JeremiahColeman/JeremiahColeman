/** Formats a Postgres date ("2026-12-25") without shifting it across time zones. */
export function formatDate(date: string | null | undefined, style: "long" | "short" = "long") {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatPrice(cents: number | null | undefined, currency = "USD") {
  if (cents === null || cents === undefined) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** Who a list is for: the owner, or the person they made it for. */
export function recipientOf(list: {
  recipient_is_owner: boolean;
  recipient_name: string | null;
  owner?: { display_name: string } | null;
}) {
  return list.recipient_is_owner ? (list.owner?.display_name ?? "") : (list.recipient_name ?? "");
}
