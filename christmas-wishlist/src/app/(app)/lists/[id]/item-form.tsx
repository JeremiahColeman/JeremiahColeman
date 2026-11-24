"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { UnfurlResponse } from "@/app/api/unfurl/route";
import { PRIORITY_LABELS, type ItemView } from "@/components/item-card";
import { ItemImage } from "@/components/item-image";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, inputClass, Notice } from "@/components/ui";
import type { ItemFormState } from "@/lib/actions/items";

type Values = {
  url: string;
  title: string;
  price: string;
  currency: string;
  image_url: string;
  notes: string;
  priority: number;
  quantity_wanted: number;
};

const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "NZD", "MXN"];

function toValues(item?: ItemView): Values {
  return {
    url: item?.url ?? "",
    title: item?.title ?? "",
    price: item?.price_cents != null ? (item.price_cents / 100).toFixed(2) : "",
    currency: item?.currency ?? "USD",
    image_url: item?.image_url ?? "",
    notes: item?.notes ?? "",
    priority: item?.priority ?? 2,
    quantity_wanted: item?.quantity_wanted ?? 1,
  };
}

const looksLikeLink = (v: string) => /^(https?:\/\/)?[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(v.trim());

type Lookup = { state: "idle" | "loading" | "filled" | "partial" | "failed"; message?: string };

/**
 * Add or edit an item. Pasting a link looks up the title, picture, and price;
 * anything the person already typed is kept.
 */
export function ItemForm({
  action,
  item,
  submitLabel,
  onDone,
  onCancel,
}: {
  action: (prev: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: ItemView;
  submitLabel: string;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState(action, {} as ItemFormState);
  const [values, setValues] = useState<Values>(() => toValues(item));
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  // Fields the person typed in themselves; autofill never overwrites these.
  const typed = useRef(new Set<keyof Values>(item ? ["title", "price", "image_url"] : []));
  const lastLooked = useRef(item?.url ?? "");
  const request = useRef(0);

  // After a successful save: reset (add) or close (edit).
  const handled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.ok || handled.current === state.nonce) return;
    handled.current = state.nonce;
    if (!item) {
      setValues(toValues());
      setLookup({ state: "idle" });
      typed.current.clear();
      lastLooked.current = "";
    }
    onDone?.();
  }, [state, item, onDone]);

  const set = <K extends keyof Values>(key: K, value: Values[K], byPerson = true) => {
    if (byPerson) typed.current.add(key);
    setValues((v) => ({ ...v, [key]: value }));
  };

  async function lookUp(raw: string) {
    const link = raw.trim();
    if (!looksLikeLink(link) || link === lastLooked.current) return;
    lastLooked.current = link;
    const id = ++request.current;
    setLookup({ state: "loading" });
    try {
      const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
      const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
      const data = (await res.json()) as UnfurlResponse;
      if (id !== request.current) return; // a newer link was pasted
      const f = data.fields ?? {};
      setValues((v) => {
        const next = { ...v };
        const fill = (key: keyof Values, value: string | undefined) => {
          if (value && !typed.current.has(key)) (next[key] as string) = value;
        };
        fill("title", f.title);
        fill("image_url", f.image_url);
        if (f.price_cents != null) fill("price", (f.price_cents / 100).toFixed(2));
        if (f.currency && !typed.current.has("price")) next.currency = f.currency;
        return next;
      });
      const found = [f.title && "name", f.image_url && "picture", f.price_cents != null && "price"].filter(Boolean);
      if (found.length === 3) setLookup({ state: "filled" });
      else if (found.length) setLookup({ state: "partial", message: `Found the ${found.join(" and ")}.` });
      else setLookup({ state: "failed", message: data.message });
    } catch {
      if (id === request.current) setLookup({ state: "failed" });
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field label="Link to the item (optional)" hint="Paste a link from any store and we'll fill in what we can.">
        <div className="flex gap-2">
          <input
            name="url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            value={values.url}
            onChange={(e) => set("url", e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (looksLikeLink(pasted)) setTimeout(() => lookUp(pasted), 0);
            }}
            onBlur={(e) => lookUp(e.target.value)}
            placeholder="https://"
            className={inputClass}
          />
          {looksLikeLink(values.url) ? (
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 px-4"
              onClick={() => {
                lastLooked.current = "";
                lookUp(values.url);
              }}
              aria-label="Fill in details from the link"
            >
              Fill in
            </Button>
          ) : null}
        </div>
      </Field>

      <div aria-live="polite">
        {lookup.state === "loading" ? <Notice>Looking up the details…</Notice> : null}
        {lookup.state === "filled" ? <Notice tone="success">Filled in from the link. Check it looks right.</Notice> : null}
        {lookup.state === "partial" ? (
          <Notice>{lookup.message} Please fill in the rest below.</Notice>
        ) : null}
        {lookup.state === "failed" ? (
          <Notice>That store didn&apos;t share its details. Type them below. The link is still saved.</Notice>
        ) : null}
      </div>

      <Field label="Name">
        <input
          name="title"
          required
          maxLength={300}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="For example, Blue wool scarf"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Price (optional)">
          <input
            name="price"
            inputMode="decimal"
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>
        <Field label="Currency">
          <select
            name="currency"
            value={values.currency}
            onChange={(e) => set("currency", e.target.value)}
            className={`${inputClass} pr-8`}
          >
            {[...new Set([values.currency, ...CURRENCIES])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">How many?</legend>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            className="w-14 px-0 text-2xl"
            aria-label="One fewer"
            disabled={values.quantity_wanted <= 1}
            onClick={() => set("quantity_wanted", Math.max(1, values.quantity_wanted - 1))}
          >
            −
          </Button>
          <output aria-live="polite" className="w-10 text-center text-2xl font-bold">
            {values.quantity_wanted}
          </output>
          <input type="hidden" name="quantity_wanted" value={values.quantity_wanted} />
          <Button
            type="button"
            variant="secondary"
            className="w-14 px-0 text-2xl"
            aria-label="One more"
            disabled={values.quantity_wanted >= 99}
            onClick={() => set("quantity_wanted", Math.min(99, values.quantity_wanted + 1))}
          >
            +
          </Button>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-semibold">How much do you want it?</legend>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((p) => (
            <label
              key={p}
              className={`flex min-h-13 cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-center text-base font-semibold ${
                values.priority === p ? "border-pine bg-pine-soft text-pine-dark" : "border-line bg-white"
              }`}
            >
              <input
                type="radio"
                name="priority"
                value={p}
                checked={values.priority === p}
                onChange={() => set("priority", p)}
                className="sr-only"
              />
              {PRIORITY_LABELS[p]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Notes (optional)" hint="Size, color, or anything else that helps.">
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={`${inputClass} py-3`}
        />
      </Field>

      <input type="hidden" name="image_url" value={values.image_url} />
      {values.image_url ? (
        <div className="flex items-center gap-4">
          <ItemImage src={values.image_url} alt="Picture of the item" />
          <Button type="button" variant="quiet" onClick={() => set("image_url", "")}>
            Remove picture
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        {onCancel ? (
          <Button type="button" variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
