# Home Education Log

A web app for UK home-educating families to keep a per-child, per-subject,
dated record of learning activities and evidence — useful for your own
records, and as evidence if your Local Authority asks about your child's
education under the Children Not in School registration and support duties.

See `PLAN.md` for the full design rationale and data model.

## What it does

- Each **family** account can have multiple **guardians** (co-parents,
  carers) sharing access — invite a co-guardian from the Family page.
- Each **child** gets their own profile (name, date of birth, year group).
- Each child has **subjects** (seeded with English/Maths/Science/Wider
  Learning, fully editable — there's no fixed curriculum requirement for
  home education in the UK).
- Every **log entry** is dated, tied to a subject (or marked general), and
  can include a title, notes, an activity type (note / work sample /
  outing / resource / assessment / other), and an optional link to
  evidence hosted elsewhere (e.g. a photo in cloud storage).
- Each child has a printable **evidence report** (optionally filtered by
  date range) grouped by subject — open it and use your browser's
  print-to-PDF to produce something to share with an LA if asked.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values:
   - `DATABASE_URL` — a Postgres connection string (Vercel Postgres/Neon in production).
   - `AUTH_SECRET` — generate with `npx auth secret`.
   - `EMAIL_SERVER` / `EMAIL_FROM` — SMTP credentials for magic-link sign-in (the primary sign-in method — realistic for parents without a GitHub account).
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — optional secondary sign-in via a GitHub OAuth app.
3. Run migrations against your database: `npm run db:migrate`.
4. `npm run dev`.

At least one of the email or GitHub provider must be configured for sign-in
to work.

## Scripts

- `npm run dev` — local dev server.
- `npm run build` — production build (typechecks and lints as part of the Next.js build step).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — ESLint.
- `npm run db:generate` — generate a Drizzle migration from `src/db/schema.ts`.
- `npm run db:migrate` — apply pending migrations to `DATABASE_URL`.

## Deployment (Vercel)

1. Import the repo into Vercel.
2. Provision Vercel Postgres (sets `DATABASE_URL` automatically).
3. Set the remaining env vars listed above in Vercel Project Settings (Production + Preview), plus `AUTH_URL` set to your deployed URL.
4. Run `npm run db:migrate` against the production database (one-off, from a machine with `DATABASE_URL` set to the prod value).
5. Deploy.

## Security notes

- Every child/subject/log-entry query is scoped by the signed-in guardian's
  `family_id`, derived server-side from their session — never from a
  client-supplied id. A record belonging to another family always 404s.
- No password is ever stored — sign-in is magic-link email or OAuth only.
- All input is validated with zod (`src/lib/validation.ts`) before any
  database write; evidence links are restricted to `http(s)://`.
- A child profile is archived, never hard-deleted, by the "remove child"
  action — this app's whole purpose is retaining evidence, so a stray
  click cannot destroy a family's records.
- Security headers (CSP, HSTS, X-Frame-Options, etc.) are set on every
  response in `next.config.mjs`.
