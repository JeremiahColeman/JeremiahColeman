"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { createClaim, deleteClaim, updateClaim, type ClaimResult } from "@/lib/actions/claims";
import { itemStatus, type MyClaim } from "@/lib/claims";
import { useTotals } from "./live-totals";

const CHIP_STYLES = {
  available: "bg-pine-soft text-pine-dark",
  partial: "bg-gold-soft text-gold",
  reserved: "bg-berry-soft text-berry",
  purchased: "bg-berry-soft text-berry",
};

/** Available / Reserved / Purchased / "2 of 3 taken". Counts only, never names. */
export function StatusChip({ itemId, wanted }: { itemId: string; wanted: number }) {
  const status = itemStatus(useTotals(itemId), wanted);
  return (
    <span
      data-testid="status-chip"
      className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${CHIP_STYLES[status.kind]}`}
    >
      {status.kind === "available" ? "✓ " : ""}
      {status.label}
    </span>
  );
}

function Stepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <Button
        type="button"
        variant="secondary"
        className="w-13 px-0 text-2xl"
        aria-label="One fewer"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </Button>
      <output aria-live="polite" className="w-8 text-center text-2xl font-bold">
        {value}
      </output>
      <Button
        type="button"
        variant="secondary"
        className="w-13 px-0 text-2xl"
        aria-label="One more"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </Button>
    </div>
  );
}

/**
 * What the viewer can do with an item: reserve it, or manage their own claim.
 * Other people's claims only ever show up as counts.
 */
export function ClaimPanel({
  listId,
  item,
  myClaim,
}: {
  listId: string;
  item: { id: string; title: string; quantity_wanted: number };
  myClaim?: MyClaim;
}) {
  const status = itemStatus(useTotals(item.id), item.quantity_wanted);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [qty, setQty] = useState(1);
  const [mode, setMode] = useState<"idle" | "changing" | "confirm-unreserve">("idle");

  const run = (fn: () => Promise<ClaimResult>, after?: () => void) =>
    start(async () => {
      setError(undefined);
      const result = await fn();
      if (result.error) setError(result.error);
      else after?.();
    });

  const form = (fields: Record<string, string | number>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, String(v));
    return fd;
  };

  const errorNotice = error ? <Notice tone="error">{error}</Notice> : null;

  // --- The viewer's own claim -------------------------------------------
  if (myClaim) {
    const bought = myClaim.status === "purchased";
    const many = myClaim.quantity > 1;
    // Others' share is everything taken minus mine.
    const maxForMe = myClaim.quantity + status.left;

    if (mode === "changing") {
      return (
        <div className="space-y-3 rounded-xl bg-paper p-4">
          {errorNotice}
          <p className="font-semibold">How many are you getting?</p>
          <Stepper value={qty} max={maxForMe} onChange={setQty} label="How many you're getting" />
          <p className="text-base text-muted">Up to {maxForMe} available for you.</p>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(() => updateClaim(listId, myClaim.id, form({ quantity: qty })), () => setMode("idle"))
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button variant="quiet" className="w-full" onClick={() => setMode("idle")}>
            Cancel
          </Button>
        </div>
      );
    }

    if (mode === "confirm-unreserve") {
      return (
        <div className="space-y-3 rounded-xl bg-paper p-4">
          {errorNotice}
          <p className="font-semibold">Unreserve “{item.title}”?</p>
          <p className="text-base">Others will see it as available again.</p>
          <Button
            variant="danger"
            className="w-full"
            disabled={pending}
            onClick={() => run(() => deleteClaim(listId, myClaim.id), () => setMode("idle"))}
          >
            {pending ? "Working…" : "Yes, unreserve"}
          </Button>
          <Button variant="quiet" className="w-full" onClick={() => setMode("idle")}>
            Keep it
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {errorNotice}
        <p className="rounded-xl bg-pine-soft px-4 py-3 font-bold text-pine-dark" data-testid="my-claim">
          {bought ? "✓ You bought this" : "★ You reserved this"}
          {many ? ` (${myClaim.quantity})` : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={bought ? "secondary" : "primary"}
            className="col-span-2 text-base"
            disabled={pending}
            onClick={() =>
              run(() => updateClaim(listId, myClaim.id, form({ status: bought ? "reserved" : "purchased" })))
            }
          >
            {pending ? "Saving…" : bought ? "Not bought yet" : "Mark as purchased"}
          </Button>
          {item.quantity_wanted > 1 ? (
            <Button
              variant="secondary"
              className="text-base"
              onClick={() => {
                setQty(myClaim.quantity);
                setMode("changing");
              }}
            >
              Change amount
            </Button>
          ) : null}
          <Button
            variant="danger"
            className={`text-base ${item.quantity_wanted > 1 ? "" : "col-span-2"}`}
            onClick={() => setMode("confirm-unreserve")}
          >
            Unreserve
          </Button>
        </div>
      </div>
    );
  }

  // --- No claim yet ------------------------------------------------------
  if (status.left === 0) {
    return (
      <div className="space-y-3">
        {/* Keep showing why a reserve attempt failed after the page catches up. */}
        {errorNotice}
        <p className="text-base text-muted">
          {status.kind === "purchased" ? "Someone already bought this." : "Someone already reserved this."}
        </p>
      </div>
    );
  }

  const amount = Math.min(qty, status.left);
  return (
    <div className="space-y-3">
      {errorNotice}
      {status.left > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">How many?</span>
          <Stepper value={amount} max={status.left} onChange={setQty} label="How many to reserve" />
        </div>
      ) : null}
      <Button
        className="w-full"
        disabled={pending}
        aria-label={`Reserve ${item.title}`}
        onClick={() => run(() => createClaim(listId, item.id, form({ quantity: amount, status: "reserved" })))}
      >
        {pending ? "Reserving…" : amount > 1 ? `Reserve ${amount}` : "Reserve"}
      </Button>
      <Button
        variant="quiet"
        className="w-full text-base"
        disabled={pending}
        onClick={() => run(() => createClaim(listId, item.id, form({ quantity: amount, status: "purchased" })))}
      >
        I already bought it
      </Button>
    </div>
  );
}
