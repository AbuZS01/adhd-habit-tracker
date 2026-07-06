# Security & Correctness Review - ADHD Habit Tracker

Reviewer: independent code review + application security pass
Date: 2026-07-06
Scope: full source audit against PLAN.md (threat model section 2, SR-1..SR-13), plus independent adversarial audit.

---

## Verdict: PASS

No SR is unmet. No Critical or High findings. The three builder-noted deviations were each verified against the actual source and hold up. Build, typecheck, lint, npm audit, and the 40-test suite all pass. A few Low / informational items are listed at the end; none block.

Toolchain results (run by reviewer):
- npm run typecheck (tsc --noEmit): clean, no errors.
- npm run lint (eslint .): clean.
- npm run build (next build): succeeds; middleware compiled; all 13 routes built.
- npm audit and npm audit --omit=dev: found 0 vulnerabilities.
- npm test: 40 passed, 0 failed (ownership fuzz, sanitize, streak, validation, cron-auth, nudge-engine).
- Client-bundle secret grep: extracted every secret value from .env.local and grepped .next/static - 0 hits for AUTH_SECRET, AUTH_GITHUB_SECRET, VAPID_PRIVATE_KEY, CRON_SECRET, DATABASE_URL.
- Git: no commits exist yet; .env.local is untracked and confirmed git-ignored (git check-ignore matches). .env.example holds placeholders only.

---

## Per-SR verification

**SR-1 Secret handling. MET.** env.ts, db/client.ts, auth.ts, push.ts, cron-auth.ts are all server-only. Only NEXT_PUBLIC_VAPID_PUBLIC_KEY reaches the client (env.ts:55-69), which is not a secret. Bundle grep for each real secret value: 0 hits. .gitignore covers .env*; .env.local untracked; no git history.

**SR-2 Output encoding / XSS. MET.** No live dangerouslySetInnerHTML / innerHTML / eval / new Function (only in comments and tests). User strings render via JSX text interpolation: page.tsx:77,79; habits/page.tsx:79-80; NudgePreview.tsx:16-17. The XSS-payload validation test passes.

**SR-3 Push subscription integrity. MET.** subscribe route: session-gated (10-11), zod-validated (23), upsert on (user_id, endpoint) (33-56), never echoes endpoint/keys back (58-59). Unique index push_subs_user_endpoint_idx (schema.ts:123). Subscriptions never returned to any client.

**SR-4 Authorization on every record. MET.** All habit/checkin queries filter by session userId from requireUserId() (habits:22; id-route:44,59,81; checkins:37,54; settings:24,56). user_id never taken from client body; only habitId accepted then ownership-checked (checkins:34-39). Cross-user id returns 404. Ownership fuzz tests pass.

**SR-5 Auth and session. MET.** Auth.js DB sessions, GitHub OAuth only, no password stored. Cookie httpOnly + SameSite=Lax + Secure-in-prod (auth.ts:49-59). requireUserId() at top of every protected handler; unauth returns 401. Middleware adds a cookie pre-filter (see deviation a).

**SR-6 Input validation. MET.** validation.ts: name cap 80 + control-char strip; cue/note capped; scheduleTime HH:MM regex; activeDays 0-6 / max 7; timezone via Intl; ids uuid(). All routes safeParse and return 400 on failure. Validation tests pass.

**SR-7 Cron endpoint auth. MET.** cron-auth.ts constant-time timingSafeEqual against Bearer CRON_SECRET; dispatch route returns 401 before any DB read or send (15-17). Middleware deliberately does not cookie-gate /api/cron/* (middleware.ts:34) so the bearer check is the sole gate. cron-auth test passes.

**SR-8 Dead-subscription hygiene. MET.** push.ts:83-87 flags 404/410 as dead; cron deletes the row immediately (dispatch:49-52 to push.ts:94-97). No retry of dead endpoints.

**SR-9 Rate limiting. MET (see Low-2).** rate-limit.ts fixed-window limiter applied to habits POST/PATCH/DELETE, checkins POST, push subscribe/unsubscribe, settings PATCH. Over-limit returns 429 + Retry-After.

**SR-10 CORS / method hygiene. MET.** No Access-Control-Allow-Origin anywhere; same-origin by default. Every route exports only its intended verbs; other methods return 405.

**SR-11 Notification content safety. MET.** sanitizeNotificationText (push.ts:29-32) strips control chars and caps length, applied in the engine (nudge-engine.ts:193-194,223-224) and again at send (push.ts:68-72). The SW payload is only title/body/url. Deep-link allowlisted server-side (sanitizeDeepLink push.ts:34-41) and re-validated in the SW (safePath sw.js:12-20); external, javascript, and protocol-relative URLs collapse to /.

**SR-12 Dependency hygiene. MET.** Minimal deps per section 7; lockfile present; npm audit 0 vulnerabilities.

**SR-13 Transport and headers. MET.** next.config.mjs sets CSP (script-src self, object-src none, frame-ancestors none, base-uri self), X-Content-Type-Options nosniff, Referrer-Policy, HSTS 2y includeSubDomains preload, X-Frame-Options DENY, Permissions-Policy - applied to all routes. No ignoreBuildErrors / ignoreDuringBuilds escape hatches.

---

## Builder-noted deviations - verified

**(a) Middleware cookie-presence only; authoritative check in requireUserId(). CONFIRMED and safe.** middleware.ts matches /api/:path*, exempts /api/auth/* and /api/cron/*, and returns 401 for no-cookie requests; it does not validate the session (Edge runtime cannot reach the Postgres driver, documented in-file). All eight API routes independently call requireUserId() (or bearer for cron, or Auth.js itself). No protected route skips the authoritative check; a forged or expired cookie passes middleware but fails requireUserId().

**(b) Extra src/app/api/settings/route.ts. CONFIRMED conformant.** requireUserId() returns 401 on failure; PATCH rate-limited; zod updateSettingsSchema; scoped to eq(users.id, userId) with no spoofable id param; only GET/PATCH exported, others 405.

**(c) Push endpoint requires https scheme. CONFIRMED.** httpsUrlSchema (validation.ts:90-102) parses via new URL() and requires protocol equals https, rejecting javascript: and data:. Used by pushSubscriptionSchema and unsubscribeSchema. The non-URL-endpoint test passes.

---

## Independent adversarial audit (beyond the SR list)

- IDOR: every read/write is AND(id, userId)-scoped; cross-user access returns 404; verified in code and by fuzz tests. No endpoint trusts a client user_id.
- Cron abuse / notification spam: bearer-gated constant-time; subscribe is authed + upserted + rate-limited.
- Secret leakage: none in bundle or git (verified empirically).
- Injection: Drizzle parameterised queries only; no string-built SQL; IDs uuid-validated before use.
- XSS / prompt-injection: habit text is plain-text sanitized twice and never rendered as HTML; SW uses no innerHTML/eval; no LLM in the pipeline.
- Service worker (E6): push + notificationclick only; no fetch interception, caching, or dynamic code; deep-link allowlisted.
- CORS / clickjacking: same-origin only; frame-ancestors none + X-Frame-Options DENY.
- Auth cookie: httpOnly / SameSite=Lax / Secure-in-prod; no token exposed to JS.

---

## Non-blocking findings

**Low-1 (correctness, not security) - nudge-engine todayStart uses UTC midnight derived from a local dateKey.** nudge-engine.ts:159 builds a UTC-forced timestamp from a local calendar date; for users far from UTC this can shift the today window by up to a day near midnight, potentially suppressing or double-counting a nudge at the local day boundary. Not exploitable; affects reminder timing accuracy only. Fix: compute the day boundary in the user's timezone instead of appending Z to a local date key. The same pattern appears in page.tsx:49-50 (setUTCHours).

**Low-2 (known limitation, already documented) - in-memory rate limiter is per-instance.** rate-limit.ts is a single-instance fixed-window counter; on ephemeral, horizontally-scaled Vercel functions the effective limit is limit times instance-count and resets on cold start. The file documents this and PLAN.md section 7 accepts the in-process approach first for single-operator scale. Acceptable for SR-9 now; move to a DB/Upstash counter if the app becomes multi-tenant.

**Low-3 (defense-in-depth) - deleteSubscriptionByEndpoint deletes by endpoint alone.** push.ts:94-97 lacks a userId scope. It is only reachable from the trusted server-side cron path and push endpoints are effectively globally unique per device, so there is no cross-user impact today. For consistency with the SR-4 pattern, prefer deleting by (userId, endpoint) or by row id.

**Info** - streak and day math rely on Intl en-CA / en-US formatting, correct on Node full-ICU builds (Vercel provides this). Noted as a runtime ICU dependency.

Nothing above changes the verdict.

---

## Relevant files
- C:\Users\Amir_\projects\adhd-habit-tracker\src\middleware.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\api-auth.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\cron-auth.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\app\api\cron\dispatch\route.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\validation.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\push.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\nudge-engine.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\app\api\settings\route.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\env.ts
- C:\Users\Amir_\projects\adhd-habit-tracker\next.config.mjs
- C:\Users\Amir_\projects\adhd-habit-tracker\public\sw.js
