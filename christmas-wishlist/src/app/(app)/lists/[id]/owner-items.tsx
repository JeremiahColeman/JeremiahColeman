"use client";

import { useState, type ReactNode } from "react";
import { ItemCard, type ItemView } from "@/components/item-card";
import { SubmitButton } from "@/components/submit-button";
import { Button, buttonClass } from "@/components/ui";
import { addItem, moveItem, setItemRemoved, updateItem } from "@/lib/actions/items";
import { ItemForm } from "./item-form";

export function AddItem({ listId, startOpen }: { listId: string; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [added, setAdded] = useState(0);
  if (!open) {
    return (
      <div className="space-y-3">
        {added ? (
          <p role="status" className="font-semibold text-pine">
            Added! ✓
          </p>
        ) : null}
        <Button className="w-full" onClick={() => setOpen(true)}>
          + Add an item
        </Button>
      </div>
    );
  }
  return (
    <section aria-labelledby="add-item" className="rounded-2xl border border-line bg-card p-5">
      <h2 id="add-item" className="mb-4 font-display text-2xl font-bold">
        Add an item
      </h2>
      <ItemForm
        action={addItem.bind(null, listId)}
        submitLabel="Add to list"
        onDone={() => {
          setAdded((n) => n + 1);
          setOpen(false);
        }}
        onCancel={startOpen ? undefined : () => setOpen(false)}
      />
    </section>
  );
}

function MoveButton({ listId, itemId, direction, title, disabled }: {
  listId: string;
  itemId: string;
  direction: "up" | "down";
  title: string;
  disabled: boolean;
}) {
  return (
    <form action={moveItem}>
      <input type="hidden" name="list_id" value={listId} />
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${title} ${direction}`}
        className={buttonClass("secondary", "w-full px-0 text-xl disabled:invisible")}
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

export function OwnerItem({
  listId,
  item,
  isFirst,
  isLast,
  badge,
  claim,
}: {
  listId: string;
  item: ItemView;
  isFirst: boolean;
  isLast: boolean;
  /** Managed lists only: status chip and the owner's own claim controls. */
  badge?: ReactNode;
  claim?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <section aria-label={`Edit ${item.title}`} className="rounded-2xl border-2 border-pine bg-card p-5">
        <h3 className="mb-4 font-display text-xl font-bold">Edit item</h3>
        <ItemForm
          action={updateItem.bind(null, listId, item.id)}
          item={item}
          submitLabel="Save changes"
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </section>
    );
  }

  return (
    <ItemCard item={item} badge={badge}>
      {claim ? <div className="mb-4 border-b border-line pb-4">{claim}</div> : null}
      <div className="grid grid-cols-[3.25rem_3.25rem_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <MoveButton listId={listId} itemId={item.id} direction="up" title={item.title} disabled={isFirst} />
        <MoveButton listId={listId} itemId={item.id} direction="down" title={item.title} disabled={isLast} />
        <Button variant="secondary" className="px-1 text-base" onClick={() => setEditing(true)} aria-label={`Edit ${item.title}`}>
          Edit
        </Button>
        <form action={setItemRemoved}>
          <input type="hidden" name="list_id" value={listId} />
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="removed" value="1" />
          <SubmitButton variant="danger" className="w-full px-1 text-base" pendingText="…" ariaLabel={`Remove ${item.title}`}>
            Remove
          </SubmitButton>
        </form>
      </div>
    </ItemCard>
  );
}

export function RemovedItems({ listId, items }: { listId: string; items: ItemView[] }) {
  if (!items.length) return null;
  return (
    <details className="rounded-2xl border border-line bg-card p-5">
      <summary className="min-h-11 cursor-pointer font-semibold">
        Removed items ({items.length})
      </summary>
      <ul className="mt-3 divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0 break-words text-muted line-through">{item.title}</span>
            <form action={setItemRemoved}>
              <input type="hidden" name="list_id" value={listId} />
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="removed" value="0" />
              <SubmitButton variant="secondary" className="px-4" pendingText="…" ariaLabel={`Put back ${item.title}`}>
                Put back
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
