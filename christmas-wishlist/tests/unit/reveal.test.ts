import { describe, expect, it } from "vitest";
import { revealState } from "@/lib/reveal";

const now = new Date("2026-12-26T09:00:00Z");
const base = { recipient_is_owner: true, event_date: "2026-12-25", event_date_set_at: "2026-11-01T12:00:00Z" };

describe("revealState", () => {
  it("opens the day after the event date", () => {
    expect(revealState(base, now)).toEqual({ kind: "open" });
    expect(revealState(base, new Date("2026-12-25T23:59:00Z"))).toEqual({ kind: "waiting", opensOn: "2026-12-26" });
  });
  it("needs a date, and only on the owner's own lists", () => {
    expect(revealState({ ...base, event_date: null }, now)).toEqual({ kind: "no-date" });
    expect(revealState({ ...base, recipient_is_owner: false }, now)).toEqual({ kind: "not-yours" });
  });
  it("stays closed if the date was set after it passed", () => {
    expect(revealState({ ...base, event_date_set_at: "2026-12-26T08:00:00Z" }, now)).toEqual({ kind: "date-set-late" });
  });
  it("handles month and year ends", () => {
    expect(revealState({ ...base, event_date: "2026-12-31" }, new Date("2026-12-31T10:00:00Z"))).toEqual({
      kind: "waiting",
      opensOn: "2027-01-01",
    });
  });
});
