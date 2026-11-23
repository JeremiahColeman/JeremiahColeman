export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-9 w-2/3 rounded-lg bg-line" />
      <div className="h-5 w-1/2 rounded bg-line" />
      <div className="h-28 rounded-2xl bg-line/70" />
      <div className="h-28 rounded-2xl bg-line/70" />
    </div>
  );
}

export function CenteredSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <PageSkeleton />
    </main>
  );
}
