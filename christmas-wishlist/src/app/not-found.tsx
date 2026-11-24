import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10 text-center">
      <div aria-hidden className="text-5xl">🧭</div>
      <h1 className="mt-4 font-display text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-3">The link may be old or mistyped.</p>
      <ButtonLink href="/lists" className="mt-8 w-full">
        Go to my lists
      </ButtonLink>
    </main>
  );
}
