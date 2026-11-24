import { Suspense } from "react";
import { BottomNav, NavBar } from "@/components/bottom-nav";
import { PageSkeleton } from "@/components/skeleton";
import { requireProfile } from "@/lib/auth";

/** Signed-in area. The nav is static; the session check streams in. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto max-w-xl px-4 pt-6 pb-32">
        <Suspense fallback={<PageSkeleton />}>
          <RequireProfile>{children}</RequireProfile>
        </Suspense>
      </main>
      <Suspense fallback={<NavBar />}>
        <BottomNav />
      </Suspense>
    </>
  );
}

async function RequireProfile({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return children;
}
