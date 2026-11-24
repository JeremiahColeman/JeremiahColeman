"use client";

import { Button, ButtonLink } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10 text-center">
      <div aria-hidden className="text-5xl">🎀</div>
      <h1 className="mt-4 font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3">Sorry about that. Please try again. If it keeps happening, try again in a few minutes.</p>
      <Button className="mt-8 w-full" onClick={() => reset()}>
        Try again
      </Button>
      <ButtonLink href="/lists" variant="quiet" className="mt-2 w-full">
        Go to my lists
      </ButtonLink>
    </main>
  );
}
