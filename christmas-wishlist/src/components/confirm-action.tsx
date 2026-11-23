"use client";

import { useState, type ReactNode } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button, type ButtonVariant } from "@/components/ui";

/**
 * A button that asks "are you sure?" inline before running a Server Action.
 * Easier to read and tap than a browser confirm() dialog.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  question,
  confirmLabel,
  variant = "secondary",
  confirmVariant = "danger",
  ariaLabel,
}: {
  ariaLabel?: string;
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: ReactNode;
  question: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button type="button" variant={variant} className="w-full" aria-label={ariaLabel} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl border-2 border-line bg-paper p-4" role="group">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div>{question}</div>
      <SubmitButton variant={confirmVariant} pendingText="Working…">
        {confirmLabel}
      </SubmitButton>
      <Button type="button" variant="quiet" className="w-full" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </form>
  );
}
