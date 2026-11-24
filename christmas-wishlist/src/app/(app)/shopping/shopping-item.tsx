"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { ItemImage } from "@/components/item-image";
import { Button, Notice } from "@/components/ui";
import { deleteClaim, updateClaim, type ClaimResult } from "@/lib/actions/claims";
import { formatPrice } from "@/lib/format";

export type ShoppingRow = {
  claim_id: string;
  item_id: string;
  list_id: string;
  list_title: string;
  recipient_name: string;
  recipient_is_owner: boolean;
  item_title: string;
  url: string | null;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  quantity: number;
  status: "reserved" | "purchased";
  share_name_with_recipient: boolean;
  item_removed: boolean;
  item_edited: boolean;
  can_change: boolean;
};

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

export function ShoppingItem({ row }: { row: ShoppingRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  // Flip the checkbox right away; it settles to the server's value after.
  const [shareName, setShareName] = useOptimistic(row.share_name_with_recipient);
  const bought = row.status === "purchased";
  const each = formatPrice(row.price_cents, row.currency);
  const total = row.price_cents != null ? formatPrice(row.price_cents * row.quantity, row.currency) : null;

  const run = (fn: () => Promise<ClaimResult>) =>
    start(async () => {
      setError(undefined);
      const result = await fn();
      if (result.error) setError(result.error);
    });

  return (
    <article
      aria-labelledby={`claim-${row.claim_id}`}
      className={`rounded-2xl border bg-card p-4 ${row.item_removed ? "border-berry" : "border-line"}`}
    >
      <div className="flex gap-4">
        <ItemImage src={row.image_url} className="size-16" />
        <div className="min-w-0 flex-1">
          <span
            className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${
              bought ? "bg-pine-soft text-pine-dark" : "bg-gold-soft text-gold"
            }`}
          >
            {bought ? "✓ Bought" : "★ Reserved"}
            {row.quantity > 1 ? ` × ${row.quantity}` : ""}
          </span>
          <h3 id={`claim-${row.claim_id}`} className="mt-1 text-lg leading-snug font-bold break-words">
            {row.item_title}
          </h3>
          <p className="text-muted">
            {total
              ? row.quantity > 1
                ? `${total} (${row.quantity} × ${each})`
                : total
              : "No price"}
            {" · "}
            <Link href={`/lists/${row.list_id}`} className="underline underline-offset-4">
              {row.list_title}
            </Link>
          </p>
          {row.url ? (
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex min-h-11 items-center font-semibold text-pine underline underline-offset-4"
            >
              Open store link ↗
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {row.item_removed ? (
          <Notice tone="error">
            {row.recipient_name} removed this from their list. You may want to check with them
            {bought ? " or return it" : ""}.
          </Notice>
        ) : row.item_edited ? (
          <Notice>The details changed after you reserved it. Check the price, notes, or link.</Notice>
        ) : null}
        {!row.item_removed && !row.can_change ? (
          <Notice>You&apos;re no longer on this list, so this can&apos;t be changed. You can still remove it.</Notice>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}

        {row.can_change && row.recipient_is_owner ? (
          <label className="flex min-h-13 cursor-pointer items-start gap-3 rounded-xl bg-paper p-3">
            <input
              type="checkbox"
              checked={shareName}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.checked;
                start(async () => {
                  setShareName(next);
                  setError(undefined);
                  const result = await updateClaim(row.list_id, row.claim_id, form({ share_name: next ? "1" : "0" }));
                  if (result.error) setError(result.error);
                });
              }}
              className="mt-1 size-6 shrink-0 accent-pine"
            />
            <span>
              <span className="block font-semibold">Share my name for thank-you notes</span>
              <span className="block text-base text-muted">
                After the event, {row.recipient_name} can see this gift was from you, if it&apos;s marked as bought.
              </span>
            </span>
          </label>
        ) : null}

        {confirming ? (
          <div className="space-y-2 rounded-xl border-2 border-line bg-paper p-3">
            <p className="font-semibold">Remove “{row.item_title}” from your shopping?</p>
            <p className="text-base">Others will see it as available again.</p>
            <Button
              variant="danger"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => deleteClaim(row.list_id, row.claim_id))}
            >
              {pending ? "Working…" : "Yes, remove it"}
            </Button>
            <Button variant="quiet" className="w-full" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {row.can_change ? (
              <Button
                variant={bought ? "secondary" : "primary"}
                className="text-base"
                disabled={pending}
                onClick={() =>
                  run(() => updateClaim(row.list_id, row.claim_id, form({ status: bought ? "reserved" : "purchased" })))
                }
              >
                {bought ? "Not bought yet" : "Mark as purchased"}
              </Button>
            ) : null}
            <Button
              variant="danger"
              className="text-base"
              disabled={pending}
              onClick={() => setConfirming(true)}
              aria-label={`${row.can_change ? "Unreserve" : "Remove"} ${row.item_title}`}
            >
              {row.can_change ? "Unreserve" : "Remove"}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
