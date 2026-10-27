# NPVote

Mobile-first voting site for a one-time event: 12 contestants, ~500 voters.
Public voting needs no login; a small admin dashboard opens/closes voting and shows live counts.

- Next.js (App Router) + TypeScript + plain CSS
- Supabase (Postgres) for storage; admin access is a single server-side password
- Deployed to Vercel

## How voting works

- Contestant names and photos live in the `contestants` table and are edited from `/admin`.
  `app/config.ts` keeps only the event labels and the fixed count (12).
- Each browser gets an HttpOnly `np_browser` cookie (a UUID). The first vote for that
  cookie is stored; later attempts return the stored vote.
- Uniqueness is enforced by the `votes.browser` primary key, and `cast_vote()` checks
  the "voting open" flag and inserts in a single atomic statement.
- One browser is not one person: cookies can be cleared, and a second browser or a
  private window gets another vote. There is no identity guarantee.
- `/hasil` shows the live top 3 while voting is open, then the final percentages (gold,
  silver, bronze) with a confetti celebration once the admin closes voting.

## Setup

1. Create a Supabase project (free tier is enough).
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/npvote_schema.sql` (settings, votes, `cast_vote()`).
   - `supabase/migrations/npvote_contestants.sql` (contestants table + public `photos`
     storage bucket, seeded with "Peserta 01".."Peserta 12").
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
     **Project Settings → API**.
   - `ADMIN_PASSWORD`: the password the panitia types on `/admin`. No Supabase Auth
     account is needed.

Names and photos are set from `/admin` after signing in. Photos are resized and converted
to JPEG in the browser (max 900px, quality 0.82) before upload, then stored in the public
`photos` bucket. No manual editing of files is required.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

Voting starts **closed**. Open `/admin`, enter `ADMIN_PASSWORD`, and press "Buka voting"
when ready.

## Deploy to Vercel

1. Push this folder to a Git repository.
2. In Vercel: **Add New → Project**, import the repository. The Next.js preset is detected.
3. Add the three environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`) for the Production environment.
4. Deploy. Then set `NEXT_PUBLIC_SUPABASE_URL` only if the project URL changes.

`SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PASSWORD` must never be prefixed with
`NEXT_PUBLIC_` and are never sent to the browser.

## Checks

```bash
npm run typecheck   # TypeScript
npm run build       # production build
```

Vote rules (duplicate votes, closed voting, validation): run `tests/vote_logic.sql` in the
Supabase SQL Editor. It runs in a transaction and rolls back.

Admin authorization (must return 401 without the admin cookie):

```bash
curl -i http://localhost:3000/api/admin
curl -i -X POST http://localhost:3000/api/admin -H "Content-Type: application/json" -d '{"open":true}'
```

## Security notes

- Every write goes through a server route (`/api/*`). The browser never writes to Postgres.
- `settings`, `votes`, and `contestants` have RLS enabled with no policies, and
  `anon`/`authenticated` privileges are revoked. Only the service role key (server-side)
  can read or write.
- Admin endpoints check an HttpOnly cookie holding a SHA-256 token derived from
  `ADMIN_PASSWORD`. This is deliberately simple, not account-based: anyone with the
  password can open or close voting. Uploads accept `image/jpeg` only, up to 3 MB, on top
  of the client-side compression.
- POST requests are checked against the request origin, and inputs are validated.

## Deliberately out of scope

No rate limiting, no audit log, no tie-break rule (equal totals fall back to the lower
contestant number). The `candidate between 1 and 12` check in SQL and `candidateCount` in
`app/config.ts` must stay in sync.
