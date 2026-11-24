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
| 2 | Auth, profiles, join flow | Done |
| 3 | Owner list editor, link autofill | Done |
| 4 | Buyer view, claims, Realtime | Done |
| 5 | My shopping, gift reveal | Done |
| 6 | PWA polish, Vercel deploy | App ready; deploy needs your accounts ([DEPLOY.md](DEPLOY.md)) |

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

## Sign-in and joining

- **Email sign-in, no passwords.** The email has a button *and* a 6-digit
  code. The button works on any device (it uses a token hash, not a PKCE
  cookie), so a relative can ask on a laptop and tap the link on a phone. The
  code is a fallback for people who'd rather type it.
- **Google sign-in** is optional. It shows only when
  `NEXT_PUBLIC_GOOGLE_SIGN_IN=true`.
- **First sign-in asks for a display name.** Google users get their Google name
  automatically and can change it under Account.
- **`/join/[token]`** sends you to sign in if needed, then to the name step,
  then joins the list and opens it. An owner opening their own link lands on
  their list with a note. Bad or rotated links show a friendly message.
- **Redirects after sign-in** go only to paths on this site, so an off-site
  `next` value is ignored.

## List editor (owner)

- Add items by typing, or paste a store link to fill in the name, picture,
  and price. Autofill never overwrites anything you typed.
- Set price and currency, how many you want, and how much you want it
  ("Really want", "Would like", "Nice to have"), plus notes.
- Edit, move up or down, and remove items. Removed items go to a "Removed
  items" section where you can put them back. Items are never hard-deleted,
  because a delete that failed on existing claims would reveal them.
- Share card: copy or share the invite link, or make a new link (the old one
  stops working; people who joined keep access).
- See who joined, and remove someone.
- Edit the list's name, description, date, or recipient; archive; or delete.
- Owners never see claim information on their own lists.

## Buyer view and reservations

- Each item shows **Available**, **Reserved**, **Purchased**, or a count like
  **2 of 3 taken**. Never who.
- Buttons: **Reserve** (choose how many when more than one is left), **I already
  bought it**, and on your own claim **Mark as purchased** / **Not bought
  yet**, **Change amount**, and **Unreserve**. Your claims say
  "You reserved this" or "You bought this".
- If someone else got there first, you get a plain message and the item
  updates. The database's overclaim lock is the real guard.
- On a list made for someone else, the owner sees the same statuses and can
  reserve, but still never sees names.
- **Live updates:** the page subscribes to Realtime changes on `items` and
  `item_claim_totals` for that list. RLS decides which events each person
  gets, so an owner gets no claim events on their own list (the owner's view
  doesn't even subscribe). The page also catches up when the subscription
  connects or reconnects, and when you come back to the tab, so nothing made
  in between is missed.

## My shopping

All your reservations across lists, grouped by who they're for:

- **Totals:** "Still to buy" and "Bought", overall and per person (items
  without a price are counted separately).
- **Flags:** items the owner removed after you reserved them, and items whose
  details (price, link, notes, quantity, name, picture) changed. Reordering
  doesn't count as a change.
- **Actions:** Mark as purchased / Not bought yet, and Unreserve. If the item
  was removed or you left the list, the claim can only be removed.
- **"Share my name for thank-you notes"**: shown only on lists where the
  recipient is the owner, since only those have a gift reveal.

## Gift reveal

On their own lists, the owner sees a "Gift reveal" card. It opens the day
after the event date (UTC) and shows the items marked as bought, with how many,
and "From …" only for givers who turned on "Share my name". Reserved-but-not-
bought items aren't shown. The reveal stays closed if the date was set after it
had already passed, and it isn't offered on lists made for someone else. The
database function `get_gift_reveal()` enforces all of this; the page only
explains it.

## Link autofill (`/api/unfurl?url=`)

Signed-in users only, so it can't be used as an open proxy. In
[`src/lib/unfurl/`](src/lib/unfurl):

- Accepts only `http` and `https` on the standard ports, with no passwords in
  the URL.
- Blocks private, loopback, link-local, carrier-grade NAT, multicast, and
  reserved addresses, including IPv4-mapped IPv6 and 6to4/NAT64 forms. The
  check runs inside the socket's DNS lookup, so the address checked is the
  address connected to (no DNS-rebinding gap). A host with any private record
  is refused.
- Follows at most 3 redirects, re-checking each one; stops after 5 seconds or
  2 MB (measured after decompression, so a gzip bomb can't get around it).
- Reads `og:title`, `og:image`, `product:price:amount`,
  `product:price:currency`, and JSON-LD `Product` offers (including `@graph`,
  `AggregateOffer`, and `priceSpecification`).
- Always answers 200 with whatever it found, so the form falls back to manual
  entry without an error screen.

Signed-in pages render a static shell (nav and a loading placeholder) right
away, then stream in the user's data. The server Supabase client calls
`connection()`, so per-user data is never prerendered or cached on the server.

## Local development

Requirements: Node 22+, Docker.

```bash
npm install
npx supabase start   # Postgres, Auth, Realtime, and a mail catcher
npm run env:local    # writes .env.local with the local URL and anon key
npm run dev
```

Sign-in emails go to the local mail catcher at http://127.0.0.1:54324.

If image pulls from `public.ecr.aws` hit a rate limit, pull from Docker Hub
instead: `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.

### Tests

```bash
npx supabase db reset  # optional: start from a clean database
npm run test:rls       # database privacy tests and unit tests (Vitest)
npm run test:e2e       # browser tests at an iPhone size (Playwright)
```

`e2e/smoke.spec.ts` is the spec's main flow (create a list, invite, join,
reserve, check My shopping). The browser tests build and start the app on port 3000 (or reuse a running
server) and read sign-in emails from the local mail catcher.

The RLS tests run against the local stack through the same REST and Realtime
APIs the app uses. They read keys from `supabase status` at runtime, so no keys
are committed. They use four users: owner A, buyers B and C, and outsider D. A
direct Postgres connection is used only to simulate time passing for the gift
reveal and to prove the overclaim lock blocks a concurrent transaction.

## Installable app and security

- **Add to home screen:** a web app manifest, an original gift-box icon (with a
  maskable version for Android), and iPhone home-screen settings. Account has
  step-by-step instructions for iPhone and Android.
- **Offline:** a small service worker shows a self-contained "You're offline"
  page when there's no connection. It never caches lists, items, reservations,
  or any signed-in page, so nothing personal stays on a shared device.
- **Security headers:** a Content-Security-Policy that allows connections only
  to this site and the Supabase project, plus `frame-ancestors 'none'`,
  `nosniff`, a strict referrer policy, and a permissions policy. Scripts use
  `'unsafe-inline'` because signed-in pages use a prerendered static shell,
  which nonces don't support (see the Next.js CSP guide).

## Deploying

Step-by-step instructions are in [DEPLOY.md](DEPLOY.md).

## Hosted Supabase settings for sign-in

When you set up the hosted project:

1. **Authentication → URL Configuration:** set the Site URL to the production
   domain, and add redirect URLs that end in `/**` for production, Vercel
   previews, and local, for example `https://your-domain.com/**`. Without the
   `/**`, sign-in links fall back to the Site URL and break.
2. **Authentication → Email Templates:** paste
   [`supabase/templates/magic_link.html`](supabase/templates/magic_link.html)
   into **Magic Link** and
   [`supabase/templates/confirmation.html`](supabase/templates/confirmation.html)
   into **Confirm signup**.
3. **Authentication → Providers → Google** (optional): turn it on, then set
   `NEXT_PUBLIC_GOOGLE_SIGN_IN=true` in Vercel.

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
