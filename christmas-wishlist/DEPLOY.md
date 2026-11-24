# Deploying Family Wishlist

This is a one-time setup. It takes about 30–45 minutes, most of it waiting
for a domain to verify. You'll create three free accounts: **Supabase** (the
database and sign-in), **Resend** (sends the sign-in emails), and **Vercel**
(hosts the app).

You never need the Supabase **service role** key or a database password in
the app. Keep those private and out of Vercel.

---

## 1. Supabase project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and
   select **New project**.
   - **Name:** `family-wishlist`
   - **Database password:** select **Generate a password** and save it in your
     password manager. Only the setup command in step 2 uses it.
   - **Region:** the one closest to your family.
2. When the project is ready, open **Project Settings → API** (or **Connect**)
   and copy:
   - the **Project URL** (`https://<ref>.supabase.co`)
   - the **anon** / **publishable** key (safe to share with the browser)

## 2. Create the database tables

From the `christmas-wishlist` folder on your computer:

```bash
npx supabase login                            # opens a browser to sign in
npx supabase link --project-ref <ref>         # <ref> is from the Project URL
npx supabase db push                          # applies supabase/migrations/*
```

`db push` asks for the database password from step 1.

**No terminal?** In the dashboard, open **SQL Editor**, then paste and run each
file in `supabase/migrations/`, oldest first.

## 3. Sign-in settings (Supabase → Authentication)

You need your Vercel address for this, so you can come back to it after
step 5.

1. **URL Configuration**
   - **Site URL:** your production address, for example
     `https://family-wishlist.vercel.app`.
   - **Redirect URLs:** add all of these. The `/**` at the end matters: without
     it, sign-in links break.
     - `https://family-wishlist.vercel.app/**`
     - `https://*-<your-vercel-team>.vercel.app/**` (preview deployments)
     - `http://localhost:3000/**` (local development)
2. **Providers → Email:** make sure Email is turned on. Set **Email OTP
   Length** to **6** (the sign-in email shows a 6-digit code).
3. **Email Templates**
   - **Magic Link:** set the subject to `Your Family Wishlist sign-in link` and
     paste in [`supabase/templates/magic_link.html`](supabase/templates/magic_link.html).
   - **Confirm signup:** set the subject to `Finish signing up for Family Wishlist`
     and paste in [`supabase/templates/confirmation.html`](supabase/templates/confirmation.html).
4. **Google (optional):** under **Providers → Google**, follow Supabase's
   instructions to create a Google OAuth client, then turn it on. Later, set
   `NEXT_PUBLIC_GOOGLE_SIGN_IN=true` in Vercel.

## 4. Resend for sign-in emails

Supabase's built-in email sender is for testing only: it sends just a few
emails an hour. For family use:

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add domain.** Use a domain you own, ideally a subdomain such as
   `mail.yourname.com`. Add the DNS records Resend shows you at your domain
   registrar, then wait for **Verified**. Without a verified domain, Resend
   only sends to your own address.
3. **API Keys → Create API key** with **Sending access**. Copy it. It's shown
   once.
4. In Supabase, open **Authentication → Emails → SMTP Settings**, turn on
   **Enable custom SMTP**, and enter:
   - **Sender email:** `wishlist@mail.yourname.com`
   - **Sender name:** `Family Wishlist`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** the Resend API key
5. Under **Authentication → Rate Limits**, raise **emails per hour** if needed
   (for example, to 100).

## 5. Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub, then **Add New →
   Project** and import the GitHub repository.
2. **Root Directory:** `christmas-wishlist`. The framework is detected as
   Next.js.
3. **Environment Variables** (for Production and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key from step 1 |
   | `NEXT_PUBLIC_SITE_URL` | your production address |
   | `NEXT_PUBLIC_GOOGLE_SIGN_IN` | `true` only if you did step 3.4 |

   Don't add the service role key. The app doesn't use it.
4. Select **Deploy**. Vercel deploys the production branch (usually `main`), so
   merge the pull request first, or pick the branch under **Settings → Git**.
5. Go back to step 3 and fill in the Site URL and Redirect URLs with your
   Vercel address.

## 6. Check it works

On your phone:

1. Open the app and sign in with the emailed link. Try the 6-digit code too.
2. Create a list, add an item from a store link, and copy the invite link.
3. On a second phone (or in a private window), open the invite, sign in as
   someone else, and reserve the item. The first phone shouldn't show it.
4. Add the app to your home screen (Account has instructions).

## 7. Custom domain (optional)

In Vercel, open **Settings → Domains**, add your domain, and follow the DNS
instructions. Then update the Supabase Site URL and Redirect URLs (step 3) and
`NEXT_PUBLIC_SITE_URL`.

---

## Keeping it running

- **Free Supabase projects pause** after about a week without activity. See
  "Restoring a paused Supabase project" in the README.
- **Schema changes** go in new files in `supabase/migrations/`. Apply them with
  `npx supabase db push`.
