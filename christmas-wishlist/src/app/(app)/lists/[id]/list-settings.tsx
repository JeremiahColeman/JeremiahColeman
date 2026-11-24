"use client";

import { useActionState, useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, inputClass, Notice } from "@/components/ui";
import {
  deleteList,
  setListArchived,
  updateListDetails,
  type ListDetailsState,
} from "@/lib/actions/items";

type ListInfo = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  recipient_is_owner: boolean;
  recipient_name: string | null;
  archived_at: string | null;
};

export function ListSettings({ list }: { list: ListInfo }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: ListDetailsState, formData: FormData) => {
    const result = await updateListDetails(list.id, prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {} as ListDetailsState);

  return (
    <section aria-labelledby="list-settings" className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <h2 id="list-settings" className="font-display text-xl font-bold">
        List settings
      </h2>

      {editing ? (
        <form action={action} className="space-y-5">
          {state.error ? <Notice tone="error">{state.error}</Notice> : null}
          <Field label="List name">
            <input name="title" required maxLength={120} defaultValue={list.title} className={inputClass} />
          </Field>
          {!list.recipient_is_owner ? (
            <Field label="Who is it for?">
              <input
                name="recipient_name"
                required
                maxLength={80}
                defaultValue={list.recipient_name ?? ""}
                className={inputClass}
              />
            </Field>
          ) : null}
          <Field label="Description (optional)">
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={list.description ?? ""}
              className={`${inputClass} py-3`}
            />
          </Field>
          <Field label="Event date (optional)">
            <input name="event_date" type="date" defaultValue={list.event_date ?? ""} className={inputClass} />
          </Field>
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
          <Button type="button" variant="quiet" className="w-full" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
          Edit name, description, or date
        </Button>
      )}

      {list.archived_at ? (
        <form action={setListArchived}>
          <input type="hidden" name="list_id" value={list.id} />
          <input type="hidden" name="archived" value="0" />
          <SubmitButton variant="secondary" pendingText="…">
            Unarchive list
          </SubmitButton>
        </form>
      ) : (
        <ConfirmAction
          action={setListArchived}
          fields={{ list_id: list.id, archived: "1" }}
          label="Archive list"
          question="Archive this list? It moves to the bottom of your lists. Family can still see it, and you can unarchive it anytime."
          confirmLabel="Yes, archive it"
          confirmVariant="primary"
        />
      )}

      <ConfirmAction
        action={deleteList}
        fields={{ list_id: list.id }}
        label="Delete list"
        variant="danger"
        question={
          <>
            <p className="font-semibold">Delete “{list.title}” for good?</p>
            <p className="mt-1">This removes the list for everyone and can&apos;t be undone. To keep it, archive it instead.</p>
          </>
        }
        confirmLabel="Yes, delete it"
      />
    </section>
  );
}
