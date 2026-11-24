/**
 * When the gift reveal opens. Mirrors the check in get_gift_reveal() so the
 * page can explain itself; the database is what actually enforces it.
 */
export type RevealState =
  | { kind: "not-yours" } // managed list: no reveal
  | { kind: "no-date" }
  | { kind: "waiting"; opensOn: string } // the day after the event date
  | { kind: "open" }
  | { kind: "date-set-late" }; // date was set after it had passed

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

export function revealState(
  list: { recipient_is_owner: boolean; event_date: string | null; event_date_set_at: string | null },
  now = new Date(),
): RevealState {
  if (!list.recipient_is_owner) return { kind: "not-yours" };
  if (!list.event_date || !list.event_date_set_at) return { kind: "no-date" };
  if (utcDay(new Date(list.event_date_set_at)) > list.event_date) return { kind: "date-set-late" };
  if (utcDay(now) <= list.event_date) {
    const next = new Date(`${list.event_date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return { kind: "waiting", opensOn: utcDay(next) };
  }
  return { kind: "open" };
}
