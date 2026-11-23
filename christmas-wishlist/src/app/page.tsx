import { Suspense } from "react";
import { CenteredSkeleton } from "@/components/skeleton";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import { getUser } from "@/lib/auth";

async function HomeContent() {
  if (await getUser()) redirect("/lists");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10 text-center">
      <div aria-hidden className="text-6xl">🎄</div>
      <h1 className="mt-4 font-display text-4xl font-bold">Family Wishlist</h1>
      <p className="mt-4 text-xl">Make a gift list, share it with family, and keep the surprise.</p>
      <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
        <li>✓ Family sees what&apos;s already taken, so no duplicate gifts</li>
        <li>✓ You never see what&apos;s been bought for you</li>
        <li>✓ Make lists for kids or pets, too</li>
      </ul>
      <ButtonLink href="/sign-in" className="mt-8 w-full">
        Sign in or sign up
      </ButtonLink>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<CenteredSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
