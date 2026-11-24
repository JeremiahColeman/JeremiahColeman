"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui";

export function SubmitButton({
  children,
  pendingText,
  variant,
  className = "w-full",
  ariaLabel,
}: {
  ariaLabel?: string;
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} aria-label={ariaLabel} className={className}>
      {pending ? (pendingText ?? "Working…") : children}
    </Button>
  );
}
