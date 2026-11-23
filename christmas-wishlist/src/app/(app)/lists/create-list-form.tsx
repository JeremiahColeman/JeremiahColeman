"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, inputClass, Notice } from "@/components/ui";
import { createList, type ListFormState } from "@/lib/actions/lists";

export function CreateListForm({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action] = useActionState(createList, {} as ListFormState);
  const [forSomeoneElse, setForSomeoneElse] = useState(state.values?.for_someone_else === "on");

  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        + Create a list
      </Button>
    );
  }

  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-5 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-2xl font-bold">New list</h2>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Field label="List name">
        <input name="title" required maxLength={120} defaultValue={v.title} placeholder="Christmas 2026" className={inputClass} />
      </Field>
      <Field label="Description (optional)">
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={v.description}
          placeholder="Sizes, favorite colors, things I already have…"
          className={`${inputClass} py-3`}
        />
      </Field>
      <Field label="Event date (optional)" hint="After this date, you can see which gifts were bought.">
        <input name="event_date" type="date" defaultValue={v.event_date} className={inputClass} />
      </Field>

      <label className="flex min-h-13 items-center gap-3">
        <input
          type="checkbox"
          name="for_someone_else"
          checked={forSomeoneElse}
          onChange={(e) => setForSomeoneElse(e.target.checked)}
          className="size-6 accent-pine"
        />
        <span className="font-semibold">This list is for someone else</span>
      </label>
      {forSomeoneElse ? (
        <Field label="Who is it for?" hint="For a child, a pet, or anyone without an account.">
          <input
            name="recipient_name"
            required
            maxLength={80}
            defaultValue={v.recipient_name}
            placeholder="For example, Lily"
            className={inputClass}
          />
        </Field>
      ) : null}

      <div className="flex flex-col gap-3">
        <SubmitButton pendingText="Creating…">Create list</SubmitButton>
        <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
