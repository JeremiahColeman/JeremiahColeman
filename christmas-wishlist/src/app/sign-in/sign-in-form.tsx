"use client";

import { useActionState, useState } from "react";
import { HardRedirect } from "@/components/hard-redirect";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass, Notice } from "@/components/ui";
import { sendMagicLink, verifyCode, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [sendState, send] = useActionState(sendMagicLink, { step: "email" } as SignInState);
  const [codeState, verify] = useActionState(verifyCode, { step: "email" } as SignInState);
  // "Use a different email" hides the current result; the next send shows again.
  const [dismissed, setDismissed] = useState<SignInState | null>(null);
  const sentTo = sendState.step === "code" && sendState !== dismissed ? sendState.email : null;

  if (!sentTo) {
    return (
      <form action={send} className="space-y-5">
        <input type="hidden" name="next" value={next} />
        <Field label="Your email" error={sendState.step === "email" ? sendState.error : undefined}>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={sendState.email}
            placeholder="name@example.com"
            className={inputClass}
          />
        </Field>
        <SubmitButton pendingText="Sending…">Email me a sign-in link</SubmitButton>
        <p className="text-base text-muted">No password needed. New here? This also creates your account.</p>
      </form>
    );
  }

  const codeError = codeState.step === "code" ? codeState.error : undefined;
  return (
    <div className="space-y-5">
      <Notice tone="success">
        <p className="font-semibold">Check your email</p>
        <p>
          We sent a sign-in link to <strong className="break-all">{sentTo}</strong>. Tap the link in that email to sign
          in.
        </p>
      </Notice>

      <form action={verify} className="space-y-4">
        <HardRedirect to={codeState.step === "code" ? codeState.redirectTo : undefined} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={sentTo} />
        <Field label="Or type the 6-digit code from the email" error={codeError}>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            placeholder="123456"
            className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
          />
        </Field>
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      </form>

      <div className="flex flex-col items-start gap-2 text-base">
        <form action={send}>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={sentTo} />
          <input type="hidden" name="resend" value="1" />
          <button type="submit" className="font-semibold text-pine underline underline-offset-4">
            Send the email again
          </button>
        </form>
        {sendState.step === "code" && sendState.resent ? <span className="text-muted">Sent again.</span> : null}
        <button
          type="button"
          onClick={() => setDismissed(sendState)}
          className="font-semibold text-pine underline underline-offset-4"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}
