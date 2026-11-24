import type { ReactNode } from "react";
import { ItemImage } from "@/components/item-image";
import { formatPrice } from "@/lib/format";

export type ItemView = {
  id: string;
  title: string;
  url: string | null;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  notes: string | null;
  priority: number;
  quantity_wanted: number;
};

export const PRIORITY_LABELS: Record<number, string> = { 1: "Really want", 2: "Would like", 3: "Nice to have" };

function storeName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "store";
  }
}

/** One item's details. Holds no claim information; callers add their own controls. */
export function ItemCard({ item, children, badge }: { item: ItemView; children?: ReactNode; badge?: ReactNode }) {
  const price = formatPrice(item.price_cents, item.currency);
  return (
    <article className="rounded-2xl border border-line bg-card p-4" aria-labelledby={`item-${item.id}`}>
      <div className="flex gap-4">
        <ItemImage src={item.image_url} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {item.priority === 1 ? (
              <span className="rounded-full bg-berry-soft px-2.5 py-0.5 text-sm font-semibold text-berry">
                ♥ Really want
              </span>
            ) : null}
            {item.priority === 3 ? (
              <span className="rounded-full bg-line px-2.5 py-0.5 text-sm font-semibold text-muted">Nice to have</span>
            ) : null}
            {badge}
          </div>
          <h3 id={`item-${item.id}`} className="mt-1 text-lg leading-snug font-bold break-words">
            {item.title}
          </h3>
          <p className="mt-1 text-muted">
            {[price, item.quantity_wanted > 1 ? `Wants ${item.quantity_wanted}` : null].filter(Boolean).join(" · ")}
          </p>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-1 inline-flex min-h-11 items-center font-semibold text-pine underline underline-offset-4"
            >
              View at {storeName(item.url)} ↗
            </a>
          ) : null}
        </div>
      </div>
      {item.notes ? <p className="mt-3 rounded-xl bg-paper px-3 py-2 whitespace-pre-line">{item.notes}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
