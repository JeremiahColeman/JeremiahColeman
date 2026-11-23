import { Suspense } from "react";
import { CenteredSkeleton } from "@/components/skeleton";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NameForm } from "@/components/name-form";
import { Card } from "@/components/ui";
import { getProfile, getUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Welcome" };

async function WelcomePageContent({ searchParams }: PageProps<"/welcome">) {
  const next = safeNext((await searchParams).next);
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const profile = await getProfile();
  if (profile?.display_name) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div aria-hidden className="text-5xl">👋</div>
        <h1 className="mt-3 font-display text-3xl font-bold">Welcome!</h1>
        <p className="mt-2 text-muted">What should your family call you?</p>
      </div>
      <Card>
        <NameForm initial="" next={next} submitLabel="Continue" />
      </Card>
    </main>
  );
}

export default function WelcomePage(props: PageProps<"/welcome">) {
  return (
    <Suspense fallback={<CenteredSkeleton />}>
      <WelcomePageContent {...props} />
    </Suspense>
  );
}
