"use client";

import { useActionState } from "react";
import { HardRedirect } from "@/components/hard-redirect";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass, Notice } from "@/components/ui";
import { saveDisplayName, type NameState } from "@/lib/actions/profile";

export function NameForm({
  initial,
  next,
  submitLabel,
}: {
  initial: string;
  /** Where to go after saving. Omit to stay on the page. */
  next?: string;
  submitLabel: string;
}) {
  const [state, action] = useActionState(saveDisplayName, { value: initial } as NameState);
  return (
    <form action={action} className="space-y-5">
      <HardRedirect to={state.redirectTo} />
      {next !== undefined ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Your name" hint="Family members see this name on lists you share." error={state.error}>
        <input
          name="display_name"
          autoComplete="name"
          required
          maxLength={60}
          defaultValue={state.value}
          placeholder="For example, Grandma Jo"
          className={inputClass}
        />
      </Field>
      {state.saved && !state.redirectTo ? <Notice tone="success">Saved.</Notice> : null}
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
