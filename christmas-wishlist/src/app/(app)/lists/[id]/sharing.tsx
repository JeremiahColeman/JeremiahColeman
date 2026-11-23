import { ConfirmAction } from "@/components/confirm-action";
import { ShareLink } from "@/components/share-link";
import { removeMember, rotateInviteLink } from "@/lib/actions/items";

export function ShareCard({ listId, title, inviteUrl }: { listId: string; title: string; inviteUrl: string }) {
  return (
    <section aria-labelledby="invite" className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <div>
        <h2 id="invite" className="font-display text-xl font-bold">
          Invite family
        </h2>
        <p className="mt-1 text-muted">Anyone with this link can see the list after they sign in.</p>
      </div>
      <ShareLink url={inviteUrl} title={title} />
      <ConfirmAction
        action={rotateInviteLink}
        fields={{ list_id: listId }}
        label="Make a new link"
        variant="quiet"
        confirmVariant="primary"
        question="Make a new invite link? The old link stops working. People who already joined keep their access."
        confirmLabel="Yes, make a new link"
      />
    </section>
  );
}

export function MembersCard({
  listId,
  members,
}: {
  listId: string;
  members: { user_id: string; display_name: string }[];
}) {
  return (
    <section aria-labelledby="members" className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 id="members" className="font-display text-xl font-bold">
        Who can see this list {members.length ? `(${members.length})` : ""}
      </h2>
      {members.length === 0 ? (
        <p className="text-muted">No one has joined yet. Send them the invite link above.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.user_id} className="space-y-2">
              <p className="font-semibold">{m.display_name || "Family member"}</p>
              <ConfirmAction
                action={removeMember}
                fields={{ list_id: listId, user_id: m.user_id }}
                label="Remove"
                ariaLabel={`Remove ${m.display_name} from this list`}
                variant="quiet"
                question={`Remove ${m.display_name} from this list? They won't see it anymore. They could rejoin with the old invite link, so make a new link too if you need to.`}
                confirmLabel="Yes, remove"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
