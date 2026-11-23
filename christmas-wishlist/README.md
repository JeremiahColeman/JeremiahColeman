# Christmas Wishlist

A mobile-first family wishlist app. Family members make gift lists, share them
with an invite link, and reserve or mark items as purchased without spoiling
the surprise.

Stack: Next.js (App Router, TypeScript), Tailwind CSS, Supabase (Postgres,
Auth, Realtime) through `@supabase/ssr`, hosted on Vercel.

## Status

| Step | What | Status |
|---|---|---|
| 1 | Scaffold, schema, RLS, triggers, functions, RLS tests | Done |
| 2 | Auth, profiles, join flow | Not started |
| 3 | Owner list editor, link autofill | Not started |
| 4 | Buyer view, claims, Realtime | Not started |
| 5 | My shopping, gift reveal | Not started |
| 6 | PWA polish, Vercel deploy | Not started |

## Privacy model

The database enforces these rules with row-level security and
security-definer functions. The UI doesn't have to get them right.

1. A list owner sees nothing about claims on their own list.
2. Other people on the list see each item's status and counts, never who
   claimed it.
3. Each person sees only their own claims.
4. On a list made for someone without an account (`recipient_is_owner =
   false`), the owner is treated like a buyer: totals yes, identities no.
5. After the event date, the owner can open a gift reveal. A giver's name
   appears only if that giver opted in on their claim.

The schema is in
[`supabase/migrations/20261123000000_init.sql`](supabase/migrations/20261123000000_init.sql).

### Extra safeguards beyond the spec

These close leaks the spec didn't call out:

- **Claim authorization runs before the overclaim check.** Postgres runs
  `BEFORE` triggers before RLS `WITH CHECK`. Without this, an owner trying to
  claim on their own list could see "Only 0 left" and learn that someone had
  claimed.
- **`recipient_is_owner` can't change after a list is created.** Otherwise an
  owner could flip it to `false` and see totals on their own list.
- **Items can't move between lists**, for the same reason.
- **Items can't be hard-deleted**, only soft-deleted. A hard delete would fail
  on existing claims and reveal them.
- **The gift reveal checks when the event date was set.** It opens only if the
  date was set before that date arrived, so an owner can't change the date to
  yesterday to peek early.
- **`items.updated_at` changes only on edits a buyer cares about** (title,
  link, image, price, notes, quantity), not on reordering. My shopping uses it
  to flag edited items.
- **Every item gets a zeroed totals row on creation**, so claim activity only
  ever appears as an `UPDATE` in Realtime.
- **Helper functions live in a `private` schema** that the API doesn't expose.
  Signed-out visitors can't read any table or call any function.

### Small deviations from the spec

- `item_claim_totals` has a `list_id` column so Realtime can filter by list.
- The owner can read their own removed items (to read back and undo a soft
  delete). Members can't.
- You can always delete (unreserve) your own claim, even after the owner
  removes the item or you leave the list.
- Lowering a claim's quantity, or changing only its status or share toggle, is
  always allowed, even if the owner later lowered the wanted quantity.

## Local development

Requirements: Node 22+, Docker.

```bash
npm install
npx supabase start        # starts Postgres, Auth, Realtime locally
cp .env.example .env.local # then fill in the anon key from `npx supabase status`
npm run dev
```

If image pulls from `public.ecr.aws` hit a rate limit, pull from Docker Hub
instead: `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.

### Tests

```bash
npx supabase db reset  # optional: start from a clean database
npm run test:rls
```

The RLS tests run against the local stack through the same REST and Realtime
APIs the app uses. They read keys from `supabase status` at runtime, so no keys
are committed. They use four users: owner A, buyers B and C, and outsider D. A
direct Postgres connection is used only to simulate time passing for the gift
reveal and to prove the overclaim lock blocks a concurrent transaction.

## Known limits

- The Supabase project admin can see raw claims in the Supabase dashboard. The
  app has no admin screen that shows claims.
- An owner could make a second account and join their own list. The app
  doesn't try to prevent this.
- An owner can move the event date earlier (for example, to tomorrow) and wait
  a day. The reveal blocks only dates moved into the past.
- Supabase pauses free projects after about a week of inactivity. See below.

## Restoring a paused Supabase project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the project. A paused project shows a **Restore project** button.
3. Select **Restore project** and wait a few minutes for it to come back.
   Data, auth users, and settings are kept.
4. Open the app to check that sign-in works.

To avoid pauses, open the app at least once a week, or upgrade to a paid plan.
