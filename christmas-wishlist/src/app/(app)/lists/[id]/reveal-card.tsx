import { ButtonLink } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { RevealState } from "@/lib/reveal";

/** Owner's own lists only. Says nothing about whether anything was bought. */
export function RevealCard({ listId, state }: { listId: string; state: RevealState }) {
  if (state.kind === "not-yours") return null;
  return (
    <section aria-labelledby="reveal" className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 id="reveal" className="font-display text-xl font-bold">
        🎁 Gift reveal
      </h2>
      {state.kind === "open" ? (
        <>
          <p>The event has passed. See which gifts were bought, and who chose to share their name.</p>
          <ButtonLink href={`/lists/${listId}/reveal`} className="w-full">
            Open the gift reveal
          </ButtonLink>
        </>
      ) : state.kind === "waiting" ? (
        <p>
          On <strong>{formatDate(state.opensOn)}</strong> you can see which gifts were bought, and thank the people who
          chose to share their name.
        </p>
      ) : state.kind === "no-date" ? (
        <p className="text-muted">Add an event date in List settings to see which gifts were bought after the day.</p>
      ) : (
        <p className="text-muted">
          The event date was changed after it had passed, so the gift reveal isn&apos;t available for this list. This
          keeps reservations a surprise.
        </p>
      )}
    </section>
  );
}
