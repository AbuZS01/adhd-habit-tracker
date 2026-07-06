# ADHD Habit Tracker

A PWA habit tracker built for inattentive-type ADHD. See `PLAN.md` for the
full design rationale, threat model, and build order.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values:
   - `DATABASE_URL` — a Postgres connection string (Vercel Postgres/Neon in production).
   - `AUTH_SECRET` — generate with `npx auth secret`.
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — a GitHub OAuth app's credentials.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — generate with `npm run vapid:generate`.
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — same value as `VAPID_PUBLIC_KEY` (this one is intentionally public).
   - `CRON_SECRET` — any long random string.
3. Run migrations against your database: `npm run db:migrate`.
4. `npm run dev`.

## Scripts

- `npm run dev` — local dev server.
- `npm run build` — production build (typechecks and lints as part of the Next.js build step).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — ESLint.
- `npm run db:generate` — generate a Drizzle migration from `src/db/schema.ts`.
- `npm run db:migrate` — apply pending migrations to `DATABASE_URL`.
- `npm run vapid:generate` — generate a new VAPID keypair for web push.

## Deployment (Vercel)

See `PLAN.md` section 8 for the full checklist. Summary:

1. Import the repo into Vercel.
2. Provision Vercel Postgres (sets `DATABASE_URL` automatically).
3. Set the remaining env vars listed above in Vercel Project Settings (Production + Preview).
4. `vercel.json` already defines the Cron schedule hitting `/api/cron/dispatch` every 15 minutes; Vercel attaches `CRON_SECRET` as the bearer token automatically.
5. Run `npm run db:migrate` against the production database (one-off, from a machine with `DATABASE_URL` set to the prod value).
6. Deploy, then open the site on a phone and "Add to Home Screen" (required for iOS push).

## Security requirements (SR-1..SR-13) — reviewer checklist

This maps 1:1 to PLAN.md section 6. See the codebase for the authoritative
implementation; this table is a navigation aid.

| SR | Requirement | Where enforced |
|----|-------------|-----------------|
| SR-1 | No secret in client bundle or git | `src/lib/env.ts` (server-only loader), `.gitignore`, `.env.example` (placeholders only). Only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` reaches the client. |
| SR-2 | No XSS via habit name/note | No `dangerouslySetInnerHTML` anywhere in `src/`. All rendering goes through JSX interpolation (React auto-escaping). ESLint rule `react/no-danger` set to `error`. |
| SR-3 | Push subscription integrity | `src/app/api/push/subscribe/route.ts` — authenticated, zod-validated, upserted on `(user_id, endpoint)`, never returned to any client. |
| SR-4 | Authorization on every record | `src/lib/api-auth.ts` (`requireUserId`), every query in `src/app/api/habits/**`, `src/app/api/checkins/**` filters by session-derived `user_id`; `[id]` routes verify ownership before acting. |
| SR-5 | Auth & session | `src/lib/auth.ts` (httpOnly/Secure/SameSite=Lax cookie, database session strategy, no password), `src/middleware.ts` (rejects unauthenticated `/api/**` except `/api/auth/**` and `/api/cron/**`). |
| SR-6 | Input validation | `src/lib/validation.ts` — zod schema for every request body/query. |
| SR-7 | Cron endpoint auth | `src/app/api/cron/dispatch/route.ts` — `Authorization: Bearer <CRON_SECRET>` required, compared with `crypto.timingSafeEqual`. |
| SR-8 | Dead-subscription hygiene | `src/lib/push.ts` (`sendPushNotification` detects 404/410), `src/app/api/cron/dispatch/route.ts` deletes immediately via `deleteSubscriptionByEndpoint`. |
| SR-9 | Rate limiting | `src/lib/rate-limit.ts`, applied in `habits`, `checkins`, `push/subscribe`, `push/unsubscribe`, `settings` routes. |
| SR-10 | CORS / method hygiene | No CORS headers are set (same-origin only by default); every route exports only its intended methods and returns 405 for the rest. |
| SR-11 | Notification content safety | `src/lib/push.ts` (`sanitizeNotificationText`, `sanitizeDeepLink`), `public/sw.js` re-validates the deep-link path against an allowlist. |
| SR-12 | Dependency hygiene | `npm audit` clean (0 vulnerabilities) as of this build; lockfile committed. |
| SR-13 | Transport & headers | `next.config.mjs` sets CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Permissions-Policy` on every route. HTTPS enforced by Vercel. |

## Known placeholders to replace before real deployment

- `public/icons/*.png` are 1x1 placeholder PNGs — replace with real 192/512
  (and maskable variants) icons before shipping.
- `.env.local` in this repo (git-ignored) contains obviously-fake dev
  placeholder values so the app can build/typecheck without a live
  database. Replace all of them with real values in Vercel before deploy.
