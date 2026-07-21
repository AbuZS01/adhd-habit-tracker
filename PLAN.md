# Build Plan: Home Education Log

## 1. Restated goal

A web app for UK families who home-educate their children, built to make it
easy to (a) keep a running, dated record of each child's learning across
subjects, and (b) produce that record as evidence if a Local Authority
exercises its registration/support duties toward home-educating families.
Each child gets their own profile; each child's subjects are separate
sections; every note, activity, or upload-in-spirit (this build stores
evidence as dated text entries with an optional link, not file uploads —
see section 3) carries a date so a chronological record can be reconstructed
at any time.

**Not legal advice.** This app is a record-keeping tool. It does not
determine what counts as a "suitable" education, does not submit anything
to a Local Authority automatically, and is not a substitute for reading the
actual guidance that applies to your family. It just makes it easy to keep
the kind of dated, organised record that such conversations tend to need.

**Ambiguity resolved — file uploads:** the request mentioned uploading
evidence with a date attached. This build (per explicit scope decision)
stores entries as dated metadata — title, notes, subject, activity type,
and an optional link to evidence hosted elsewhere — rather than accepting
file uploads directly, to avoid adding a storage provider and its security
surface (upload validation, storage quotas, access-controlled serving) in
this pass. Every entry still has a date and a place for a link, so a
guardian can reference a photo/PDF hosted in their own cloud storage. File
upload can be added later (e.g. Vercel Blob) without changing the schema
shape (`log_entries.external_link` would become a stored file reference).

**Ambiguity resolved — accounts:** "each child should have their own
profile" is satisfied by scoping children to a **family**, not to an
individual login, because home education is normally a household
decision made by more than one adult. A family can have multiple
**guardians** (see section 4) who all see the same children.

**Data minimisation (UK GDPR Art. 5(1)(c)):** a child's profile stores
only **name** and **year group** — no date of birth. A DOB was considered
during design but dropped: nothing in this app's actual purpose (organising
a subject/evidence log) needs an exact birth date, so collecting it would
be personal data held beyond what's necessary for the processing, with no
matching benefit. Year group alone is enough to group/label a child's
records. This is a general principle applied throughout, not just to this
one field — see section 4 for the rest of the data model (log entries
store only what's needed to reconstruct an activity; family membership
stores only email/name via the auth provider, not any HR-style profile
data).

## 2. Threat model

**Assets worth protecting**
- A1: Children's educational records — names, year groups, and a
  detailed log of their day-to-day activities. This is sensitive,
  child-related personal data; treat it as confidential even though it is
  not a special category of health/biometric data.
- A2: Guardian authentication credentials / session tokens.
- A3: Family invite codes (leaking one lets a stranger join a family and
  see/edit a child's full record).
- A4: DB credentials and SMTP/OAuth secrets.
- A5: Data integrity of the evidence trail — entries must not be silently
  lossy or falsifiable in a way that undermines their use as a record.

**Entry points**
- E1: Auth endpoints (magic-link email request, OAuth callback).
- E2: Children/subjects/log-entries CRUD API (authenticated guardian
  input: names, dates, free text, links).
- E3: Family invite creation/acceptance endpoints.
- E4: Client-rendered strings (child names, entry titles/notes, evidence
  links) shown back in the DOM, including the printable report.

**Trust boundaries**
- Browser (untrusted) ↔ Next.js server (trusted, holds secrets).
- Server ↔ Postgres (trusted network, credentialed).
- Server ↔ SMTP/OAuth provider (authenticated, but responses untrusted).

**Top threats and the neutralising design decision**

| # | Threat | Neutralising design decision |
|---|--------|------------------------------|
| T1 | **Broken tenancy isolation** — guardian in family A reads/edits family B's child, subject, or entry by guessing/changing an id. | Every query is scoped by `family_id` derived server-side from the session's `family_members` row (`requireSessionFamily()`), never from a client-supplied id. Subject and log-entry ownership is verified by joining back to `children.family_id`, not trusted from the record's own id. |
| T2 | **Secret leakage** — DB URL, SMTP credentials, or `AUTH_SECRET` shipped to the client. | All secrets read only in `src/lib/env.ts` and server-only modules (`server-only` import). No `NEXT_PUBLIC_*` secret exists in this app (no client-side secret is needed at all, unlike the previous push-notification build). |
| T3 | **Stored XSS** via a child's name, an entry's title/notes, or an evidence link rendered into the DOM or the printable report. | No `dangerouslySetInnerHTML` anywhere; all rendering goes through JSX/React auto-escaping. Evidence links are rendered as `href` on an anchor tag (never interpolated into an `on*` handler or evaluated), and are restricted to `http:`/`https:` schemes at write time, closing off `javascript:`/`data:` link XSS. |
| T4 | **Invite code guessing/replay** — a stranger enumerates or reuses an invite to join a family and see children's records. | Invite codes are 24 random bytes (base64url, effectively unguessable), expire after 7 days, and are marked used atomically inside the same DB transaction that inserts the new membership row — a code can be consumed exactly once. |
| T5 | **Evidence tampering / accidental loss** — a misclick destroys a term's worth of records. | "Remove child" archives (`is_archived = true`) rather than hard-deletes; children, subjects, and log entries are recoverable. Deleting an individual log entry is still a hard delete (a single mis-logged entry should be correctable), but requires an explicit confirm step in the UI. |
| T6 | **Rate/abuse on write endpoints** — scripted account/child/entry creation. | Per-user fixed-window rate limits on every write endpoint (`src/lib/rate-limit.ts`). |

## 3. Stack decision

**Chosen (kept from the environment's existing Next.js/Postgres setup,
domain model replaced entirely)**
- **Next.js (App Router) + TypeScript on Vercel** — server components read
  the DB directly for pages; API routes handle all mutations from client
  components. One deploy target, no separate backend to secure.
- **Postgres via Drizzle ORM** — parameterised queries by default (kills
  SQL injection), typed schema.
- **Auth.js (NextAuth v5) — email magic-link (Nodemailer provider) as the
  primary sign-in method, GitHub OAuth optional.** Magic-link is the
  realistic default because the target user (a parent doing home
  education) is unlikely to have a GitHub account; GitHub is kept only
  because it's convenient to test with and some guardians may prefer it.
  No password is ever stored either way.
- **zod** for input validation on every API route.
- **No file storage provider** in this pass (see section 1's "Ambiguity
  resolved — file uploads").
- **No push notifications / service worker / cron** — none of the
  previous build's notification engine applies to this domain; it has
  been removed entirely rather than left dormant.

**Rejected**
- **A shared child login** (the child signs in): rejected — children
  aren't the ones producing the compliance record, and it adds an
  auth-model complexity (child accounts, parental oversight of a child's
  own login) with no benefit here.
- **File uploads via Vercel Blob in this pass:** rejected for now per the
  explicit MVP scope decision (metadata-first); the schema is shaped so
  this can be added later without a breaking migration.
- **One family per household enforced structurally beyond a unique
  `user_id` constraint:** a user belongs to at most one family in this
  model. Supporting a guardian who manages two unrelated households is
  out of scope; if needed later it requires a join-table redesign
  (`family_members` already has the right shape — the constraint to
  relax is the uniqueness on `user_id`).

## 4. Data model

```
users               — one row per guardian (Auth.js-managed identity only)
accounts/sessions/verification_token — Auth.js adapter tables
families            — the tenancy boundary; everything else hangs off family_id
family_members      — (family_id, user_id, role: owner|guardian) — multi-guardian
family_invites      — single-use, expiring (7d) codes an owner generates
children            — (family_id, name, year_group?, notes?, is_archived)
subjects            — (child_id, name, sort_order, is_archived) — per-child, not fixed
log_entries         — (child_id, subject_id?, author_user_id, entry_date, title,
                        description?, activity_type, external_link?)
```

Key relationships: `family_members.user_id` is unique (one family per
guardian). `subjects.child_id` and `log_entries.child_id` both cascade from
`children`, which cascades from `families` — deleting a family (not exposed
in the UI) removes everything beneath it; deleting a child is a soft
archive, not a cascade delete, by design (T5 above).

`log_entries.entry_date` is a plain date (no time component) chosen by the
guardian — separate from `created_at` (when the row was actually inserted)
so past activities can be logged retroactively with an accurate date,
which matters for a record that needs to reflect when learning actually
happened.

## 5. Access control summary

Every protected page/route calls `requireSessionFamily()`
(`src/lib/family.ts`), which resolves the signed-in guardian's
`family_id` and auto-provisions a new family (this guardian as `owner`) on
first login — no separate "create your family" onboarding step. Every
subsequent query filters by that `family_id` (directly for children, via a
join through `children` for subjects and log entries). A record ID from
another family always 404s rather than leaking existence.

Owner vs. guardian role: both can create/edit children, subjects, and log
entries. Only the `owner` can generate invite codes, rename the family, or
remove a guardian — this keeps membership changes auditable to the person
who set the family up, while day-to-day logging isn't gated behind a role
check that would slow down the actual point of the app.

## 6. Build order (as implemented)

1. Removed the previous build's domain entirely (habits/checkins/push/cron/
   service worker) rather than leaving dead code alongside the new domain.
2. New Drizzle schema: families, family_members, family_invites, children,
   subjects, log_entries (Auth.js tables kept, trimmed of habit-specific
   user fields).
3. Auth.js reconfigured: Nodemailer (email magic-link) as primary
   provider, GitHub optional; env loader updated.
4. `src/lib/family.ts`: session→family resolution with auto-provisioning,
   invite creation/lookup/acceptance.
5. zod schemas for every child/subject/log-entry/invite input.
6. API routes: children, children/[id], children/[id]/subjects,
   subjects/[id], entries, entries/[id], family, family/invite,
   family/invite/accept, family/members/[userId].
7. Pages: dashboard (sign-in + children list + add-child), child profile
   (subjects, log entries, add-entry form, subject management), printable
   evidence report (date-range filter, print stylesheet), family
   management (rename, invite, members), invite-acceptance flow.
8. Config/docs updated to match; dependency vulnerability in the
   Nodemailer transitive chain resolved via an `overrides` pin (see
   `package.json`) rather than accepted as a known risk.

## 7. Known limitations / possible next steps

- No file uploads yet (by explicit scope decision — see section 1).
- No email verification "resend" flow beyond Auth.js's default magic-link
  expiry/retry.
- No bulk export beyond the per-child printable report (e.g. a
  whole-family or whole-term export) — the print report already covers
  the core "produce evidence for an LA" need, but a CSV/PDF export across
  children would be a natural follow-up.
- No child-level access (e.g. an older child logging their own work) —
  every entry is authored by a guardian (`log_entries.author_user_id`).
- A guardian who already has a family cannot join a second family via
  invite (see rejected option in section 3); the invite-accept endpoint
  fails closed with a clear error in that case rather than silently
  reassigning anyone.
- "Remove child" only archives (T5) — there is no UI action yet for a
  guardian to permanently erase a child's record (GDPR's right to
  erasure). Archiving was chosen by default to protect against
  accidental data loss of evidence, but a genuine hard-delete path
  (distinct from archive, with its own explicit confirmation) would be
  needed for full erasure-request support and is a natural next step.
