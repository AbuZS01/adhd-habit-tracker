# Home Education Log

A web app for UK home-educating families to keep a per-child, per-subject,
dated record of learning activities and evidence — useful for your own
records, and as a clear, dated response if a council makes an informal
enquiry about your child's education. **Not legal advice** — see "Legal
information" below and `PLAN.md` section 1 for important caveats (the law
differs across England/Wales/Scotland/Northern Ireland, and is currently
changing in England and Wales).

See `PLAN.md` for the full design rationale and data model.

## What it does

- Each **family** account can have multiple **guardians** (co-parents,
  carers) sharing access — invite a co-guardian from the Family page.
- Set your **nation** (England/Wales/Scotland/Northern Ireland) on the
  Family page to see the right legal-standard text on your dashboard and
  evidence reports — the four nations' home-education rules diverge
  materially, so this is never assumed or defaulted.
- Each **child** gets their own profile (name, year group). No date of
  birth is collected — see "Security notes" below.
- Each child has **subjects** (seeded with English/Maths/Science/Wider
  Learning, fully editable — there's no fixed curriculum requirement for
  home education in the UK).
- Every **log entry** is dated, tied to a subject (or marked general), and
  can include a title, notes, an activity type (note / work sample /
  outing / resource / assessment / other), an optional link to evidence
  hosted elsewhere, and up to 6 uploaded **photos/PDFs** (JPEG, PNG, WebP,
  HEIC, or PDF; 15MB each) — the "+ Add photo" button on a logged entry.
  Uploads require `BLOB_READ_WRITE_TOKEN` to be configured (see Local
  setup); without it the app works fully except that button is hidden.
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
   - `BLOB_READ_WRITE_TOKEN` — optional; enables photo/PDF evidence uploads. Create a Blob store in the Vercel dashboard (Storage → Blob) and copy its read-write token.
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
3. Provision a Vercel Blob store (Storage → Blob) if you want photo/PDF uploads — this sets `BLOB_READ_WRITE_TOKEN` automatically.
4. Set the remaining env vars listed above in Vercel Project Settings (Production + Preview), plus `AUTH_URL` set to your deployed URL.
5. Run `npm run db:migrate` against the production database (one-off, from a machine with `DATABASE_URL` set to the prod value).
6. Deploy.

## Legal information

`src/lib/legal-content.ts` holds a short, nation-specific summary of the
current legal standard and duties for England, Wales, Scotland, and
Northern Ireland, shown on the dashboard and evidence report once a
family sets its nation. It is deliberately hedged and dated
(`LEGAL_CONTENT_LAST_REVIEWED`) rather than presented as a compliance
guarantee: England and Wales have legislated for a "Children Not in
School" register (Children's Wellbeing and Schools Act 2026) that is
**not yet in force**, and Scotland/Northern Ireland run entirely separate
regimes unaffected by that Act. Review and update this file's content
(and its last-reviewed date) if the law changes — do not let it go stale
silently.

## Security notes

- **Data minimisation (UK GDPR Art. 5(1)(c)):** a child's profile stores
  only name and year group — no date of birth, since nothing in this
  app's purpose needs it. See `PLAN.md` section 1 for the rationale.
- Every child/subject/log-entry query is scoped by the signed-in guardian's
  `family_id`, derived server-side from their session — never from a
  client-supplied id. A record belonging to another family always 404s.
- No password is ever stored — sign-in is magic-link email or OAuth only.
- All input is validated with zod (`src/lib/validation.ts`) before any
  database write; evidence links are restricted to `http(s)://`.
- A child profile is archived, never hard-deleted, by the "remove child"
  action — this app's whole purpose is retaining evidence, so a stray
  click cannot destroy a family's records.
- Uploaded evidence files are stored with Vercel Blob's `access: 'private'`
  — there is no public URL for them. Every read goes through
  `/api/attachments/[id]/file`, which re-checks the requester's family
  ownership before streaming the file back. Uploads themselves are gated
  the same way: the client token used to write to Blob storage is only
  issued (`/api/attachments/upload`) after verifying the target log entry
  belongs to the caller's family, with content-type and size (15MB)
  enforced server-side, not just by the file picker's `accept` attribute.
- Security headers (CSP, HSTS, X-Frame-Options, etc.) are set on every
  response in `next.config.mjs`.
