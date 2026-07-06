# Build Plan: ADHD Habit Tracker ("inattentive-first" reminders)

## 1. Restated goal

A web-based habit tracker built specifically for people with **inattentive-type ADHD**, whose core failure mode with existing tools is *tuning out* reminders (habituation) rather than impulsively dismissing them. The product's differentiator is not the habit list — it is the **notification and re-engagement engine**: reminders that vary their timing, wording, and channel so the brain cannot filter them out; implementation-intention prompts ("after X, I will Y") that convert reminders into automatic cues; ultra-low-friction check-ins (one tap); forgiving streaks that reward showing up without punishing missed days; and escalating multi-nudge sequences so a single ignored ping is not the end of the loop. Primary user is a single operator-type individual (the requester and people like them), signing in to track a small number of habits on their phone's home screen and desktop.

**Ambiguity resolved:** The request said "app." I am building a **PWA (installable web app)**, not a native iOS/Android app, because a single builder agent can ship it end-to-end this session and deploy to Vercel with no app-store review. This choice has one important consequence for notifications, addressed in detail in section 5 and section 10.

## 2. Threat model

**Assets worth protecting**
- A1: User's habit/routine data. This is **health-adjacent** — an ADHD diagnosis is implied by using the app, and routines (meds, therapy, sleep, hygiene) can be sensitive. Treat it as confidential.
- A2: Authentication credentials / session tokens.
- A3: Push subscription endpoints (leaking these lets a third party spam the user's device).
- A4: VAPID private key and any DB credentials (server secrets).
- A5: App availability and the user's trust (a habit app that spams or leaks kills adoption instantly).

**Entry points (where untrusted input/actors reach the system)**
- E1: Auth endpoints (sign-in / sign-up).
- E2: Habit CRUD and check-in API (authenticated user input: habit names, notes, times).
- E3: Push subscription registration endpoint.
- E4: The scheduled cron endpoint that fans out notifications.
- E5: Client-rendered strings (habit names/notes shown back in the DOM and inside notification bodies).
- E6: The service worker (runs with elevated origin privileges).

**Trust boundaries**
- Browser (fully untrusted) ↔ serverless API (trusted, holds secrets).
- Serverless API ↔ Postgres (trusted network, credentialed).
- Serverless API ↔ push service (Apple/Google/Mozilla endpoints; authenticated by VAPID, but responses are untrusted input).
- Cron trigger ↔ cron endpoint (must be authenticated so the fan-out can't be triggered by anyone).

**Top threats and the design decision that neutralises each**

| # | Threat | Neutralising design decision |
|---|--------|------------------------------|
| T1 | **Broken access control** — user A reads/edits user B's habits or check-ins by changing an ID. | Every query is scoped by `user_id` derived from the verified session server-side, never from a client-supplied ID. Authorization checked on every row, not just authentication. (SR-4) |
| T2 | **Secret leakage** — VAPID private key, DB URL, or auth secret shipped to the client or committed to git. | All secrets live only in Vercel environment variables, read only in server code. No secret ever imported into a client component or the service worker. `.env*` git-ignored. (SR-1) |
| T3 | **Stored XSS via habit name/note** rendered into the DOM or into a push notification body. | Framework auto-escaping for DOM; no `dangerouslySetInnerHTML`. Notification `title`/`body` are treated as plain text only; strip control chars and cap length server-side before sending. (SR-2, SR-6) |
| T4 | **Unauthenticated cron / notification-spam abuse** — attacker hits the fan-out endpoint or the subscribe endpoint to blast a device or exhaust push quota. | Cron endpoint requires a secret bearer token that only Vercel Cron knows (SR-7). Subscribe endpoint is authenticated and one subscription-per-device is upserted, not appended (SR-3). Rate-limit write endpoints (SR-9). |
| T5 | **Push subscription leak / stale endpoint abuse** — endpoints stored insecurely or dead endpoints retried forever. | Endpoints stored server-side only, tied to `user_id`, never returned to other users. On `404`/`410` from the push service the subscription is deleted immediately (SR-3, SR-8). |

## 3. Stack decision

**Chosen**

- **Next.js (App Router) on Vercel** — one repo gives both the client PWA and the server API/cron with no separate backend to secure; secrets stay server-side by construction. Safe default: server/client boundary is explicit, and route handlers keep secrets off the client.
- **TypeScript** — types catch a whole class of injection/None-handling bugs before review. Safe default: reduces "untyped client input trusted as safe" mistakes.
- **Vercel Postgres (Neon-backed) via a typed query layer (Drizzle ORM)** — persistent storage for habits/check-ins/subscriptions across devices. Parameterised queries by default kill SQL injection. Safe default: no hand-built SQL strings.
- **Auth.js (NextAuth) with a single provider (email magic-link OR GitHub OAuth)** — no password storage to leak; sessions are httpOnly cookies. Safe default: we never hold a password hash (A2 shrinks).
- **`web-push` (VAPID) for browser push + Vercel Cron for scheduling** — the *only* reliable way to deliver reminders that fire when the app is closed. This is the core justification below.
- **PWA (manifest + service worker)** so it installs to the iOS/Android home screen, which is the *precondition* for push on iOS.
- **Plain React + CSS modules (or Tailwind), no heavy UI kit** — the UI is small; interactivity (one-tap check-ins, streak animations) justifies React over static HTML here.

**Why server-scheduled push, not client-side scheduled notifications:** research confirms iOS PWAs have **no Periodic Background Sync / Background Fetch** and web push only works for home-screen-installed apps; client-scheduled `showNotification` timers do not survive the app being closed. Therefore the schedule must live on the **server** and be delivered by **Vercel Cron → web-push**. This also enables the anti-habituation logic (variable timing/wording chosen server-side) which is the whole point.

**Rejected**
- **Native React Native / Flutter app:** most reliable notifications, but requires app-store accounts, review, signing, and cannot be shipped end-to-end by one agent this session. Revisit only if push reliability proves insufficient (section 10).
- **Firebase / OneSignal push SaaS:** faster to wire, but adds a third-party data processor holding health-adjacent user identifiers and a recurring-config dependency. `web-push` + VAPID keeps data first-party and set-and-forget.
- **Supabase/Firebase full backend:** more moving parts and another vendor boundary than a single Next.js + Postgres app needs.
- **Passwords / custom auth:** rejected to avoid storing credentials (A2).
- **localStorage/IndexedDB-only, no backend:** rejected — data wouldn't sync across the phone and desktop, and there'd be no server to run the anti-habituation scheduler.

## 4. File and folder structure

```
C:\Users\Amir_\projects\adhd-habit-tracker\
├─ .env.local                      # gitignored; local secrets only
├─ .env.example                    # placeholder keys, committed
├─ .gitignore
├─ next.config.mjs
├─ package.json
├─ tsconfig.json
├─ drizzle.config.ts
├─ vercel.json                     # Vercel Cron schedule definition
├─ README.md                       # setup + SR checklist for the reviewer
├─ public\
│  ├─ manifest.webmanifest         # PWA manifest (installable)
│  ├─ icons\                       # home-screen icons (192/512, maskable)
│  └─ sw.js                        # service worker: push + notificationclick only
├─ drizzle\
│  └─ migrations\                  # generated SQL migrations
└─ src\
   ├─ db\
   │  ├─ schema.ts                 # users, habits, checkins, push_subscriptions, notification_log
   │  └─ client.ts                 # server-only DB connection
   ├─ lib\
   │  ├─ auth.ts                   # Auth.js config (server-only)
   │  ├─ push.ts                   # web-push send wrapper + dead-subscription cleanup
   │  ├─ nudge-engine.ts           # anti-habituation: timing jitter, message variants, escalation
   │  ├─ validation.ts             # zod schemas for every input
   │  ├─ rate-limit.ts             # per-user/IP limiter for write endpoints
   │  └─ env.ts                    # zod-validated server env loader (fails fast if missing)
   ├─ app\
   │  ├─ layout.tsx
   │  ├─ page.tsx                  # today view: habits + one-tap check-in
   │  ├─ onboarding\page.tsx       # <60s setup, implementation-intention builder
   │  ├─ habits\page.tsx           # manage habits (few, not many)
   │  ├─ settings\page.tsx         # quiet hours, channels, notification prefs
   │  └─ api\
   │     ├─ auth\[...nextauth]\route.ts
   │     ├─ habits\route.ts        # GET/POST (auth + zod + user-scoped)
   │     ├─ habits\[id]\route.ts   # PATCH/DELETE (ownership check)
   │     ├─ checkins\route.ts      # POST one-tap check-in
   │     ├─ push\subscribe\route.ts   # upsert subscription for this user+device
   │     ├─ push\unsubscribe\route.ts
   │     └─ cron\dispatch\route.ts    # BEARER-token-gated fan-out (called by Vercel Cron)
   ├─ components\
   │  ├─ CheckInButton.tsx
   │  ├─ StreakBadge.tsx           # forgiving streak / "showed up" counter
   │  ├─ NudgePreview.tsx
   │  └─ InstallPrompt.tsx         # guides iOS "Add to Home Screen"
   └─ sw\
      └─ register.ts               # client registers /public/sw.js
```

## 5. Data and control flow

**Where secrets live (server only, never in client code):** `AUTH_SECRET`, the auth provider secret, `DATABASE_URL`, `VAPID_PRIVATE_KEY`, and `CRON_SECRET` are all read exclusively in `src/lib/*` and route handlers under `src/app/api/**`. The **VAPID public key** is the only push value exposed to the client (it must be, to subscribe) and is delivered via a public env var. It is not a secret.

**Sign-in flow:** Browser → `/api/auth/*` (Auth.js) → magic-link email or OAuth → httpOnly, Secure, SameSite session cookie. Client never sees a token in JS.

**Create/track a habit:** Browser form → `POST /api/habits` → session verified → **zod validation** of name/schedule/implementation-intention text → insert with `user_id` from session → return sanitized record. Habit names/notes are stored raw but only ever rendered through React's auto-escaping and length-capped before any notification use.

**One-tap check-in:** `CheckInButton` → `POST /api/checkins` with only a `habitId` → server verifies that habit belongs to the session user (T1) → inserts a check-in row → returns updated streak. No streak math trusted from the client.

**Push subscription:** After install + permission grant, `sw/register.ts` subscribes with the VAPID **public** key → `POST /api/push/subscribe` sends the `PushSubscription` JSON → server **upserts** keyed on `(user_id, endpoint)` so a device has exactly one live row (T4/T5).

**The notification engine (the core):**
1. **Vercel Cron** hits `POST /api/cron/dispatch` on a fixed cadence (e.g. every 15 min), carrying the `CRON_SECRET` bearer token. The handler rejects any request without it (T4/SR-7).
2. `nudge-engine.ts` selects habits whose next nudge is due, **respecting the user's quiet hours** and timezone.
3. For each due habit it produces an **anti-habituation** notification: (a) **timing jitter** — the scheduled time is offset by a small pseudo-random delta so it never fires at the exact same clock minute; (b) **rotating message variants** — implementation-intention framing ("After you pour coffee, take your meds") rotated with encouragement and curiosity framings so wording never repeats verbatim; (c) **escalation** — if a habit is not checked in, a second, differently-worded nudge is queued a short interval later, then the engine backs off for the day (forgiving, not nagging).
4. `push.ts` sends via `web-push` with the VAPID keypair. Any `404`/`410` deletes that subscription (SR-8). Sends are logged to `notification_log` for dedupe/backoff and so the same nudge isn't sent twice.
5. `public/sw.js` receives the `push` event and calls `showNotification` with the **plain-text** title/body; `notificationclick` opens the today view deep-linked to that habit's one-tap check-in.

**Engagement/retention mechanics baked into the data model, not bolted on:**
- **Forgiving streaks:** `StreakBadge` counts "days shown up" and does not reset to zero on a single miss (configurable grace); missed days are visually neutral, never red/punitive.
- **Minimal setup:** onboarding creates 1–3 habits in under a minute with sensible default schedules; no long config wall (research: ADHD users abandon apps at the setup wall).
- **Quiet hours + snooze that isn't the old ignorable pattern:** snooze reschedules with a *new* time offset and *new* wording rather than the identical ping, so deferring doesn't retrain the tune-out reflex.
- **Positive, low-friction reinforcement:** immediate visual dopamine hit on check-in (animation/confetti), never a guilt screen.

## 6. Security requirements (testable)

- **SR-1 — Secret handling.** `AUTH_SECRET`, auth-provider secret, `DATABASE_URL`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` appear only in server-side modules and Vercel env vars. Grep of the client bundle (`.next/static`) yields none of them. `.env*` is git-ignored; `.env.example` contains placeholders only. **Met** = no secret in client bundle or git history.
- **SR-2 — Output encoding / XSS.** No `dangerouslySetInnerHTML` anywhere. All user-supplied strings render through React escaping. **Met** = a habit named `<img src=x onerror=alert(1)>` renders as inert text in the today view and in any notification.
- **SR-3 — Push subscription integrity.** `/api/push/subscribe` requires an authenticated session, validates the subscription shape with zod, and **upserts** on `(user_id, endpoint)`. Subscriptions are never returned to any client. **Met** = a second device create makes at most one new row; endpoint never appears in any GET response.
- **SR-4 — Authorization on every record.** Every habit/checkin read and write filters by the session-derived `user_id`; `[id]` routes verify ownership before acting. **Met** = user B requesting user A's habit id gets `404`/`403`, not data.
- **SR-5 — Auth & session.** Auth.js sessions use httpOnly + Secure + SameSite=Lax cookies; no password is ever stored (magic-link or OAuth). All `/api/**` except `/api/auth/**` reject unauthenticated requests. **Met** = calling any protected endpoint with no cookie returns 401.
- **SR-6 — Input validation.** Every request body/query is parsed by a zod schema before use: habit name (length-capped, control chars stripped), schedule fields (enumerated/bounded), notes (length-capped), timezone (validated IANA string). Invalid input → 400, never a partial write. **Met** = fuzzed/oversized inputs are rejected with 400.
- **SR-7 — Cron endpoint auth.** `/api/cron/dispatch` requires `Authorization: Bearer <CRON_SECRET>` and rejects all else with 401; the secret is compared with a constant-time check. **Met** = an unauthenticated POST sends zero notifications and returns 401.
- **SR-8 — Dead-subscription hygiene.** On `404`/`410` from the push service, the subscription row is deleted; sends never retry a dead endpoint. **Met** = a revoked endpoint is gone from the DB after one dispatch cycle.
- **SR-9 — Rate limiting.** Write endpoints (`checkins`, `habits`, `subscribe`) are rate-limited per user/IP so the API can't be used to flood the DB or push quota. **Met** = exceeding the limit returns 429.
- **SR-10 — CORS / method hygiene.** API routes are same-origin only (no permissive `Access-Control-Allow-Origin: *`), and each handler accepts only its intended HTTP methods. **Met** = a cross-origin browser POST is blocked; unexpected methods return 405.
- **SR-11 — Notification content safety.** Titles/bodies sent to `web-push` are plain text, length-capped, and stripped of control characters server-side; no user string is interpreted as HTML or a URL by the service worker except the deep-link path, which is validated against an allowlist of internal routes. **Met** = a crafted habit name cannot inject markup or an external URL into a notification.
- **SR-12 — Dependency hygiene.** Dependency list is minimal (section 7); `npm audit` shows no high/critical at build; lockfile committed. **Met** = clean audit at ship time.
- **SR-13 — Transport & headers.** HTTPS enforced (Vercel default); security headers set (`Content-Security-Policy` restricting script sources, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`). **Met** = headers present on responses; CSP blocks inline/foreign scripts.

## 7. Dependencies

Essentials only:
- `next`, `react`, `react-dom` — framework + UI.
- `typescript`, `@types/*` — typing.
- `next-auth` (Auth.js) — passwordless auth, httpOnly sessions.
- `drizzle-orm` + `@vercel/postgres` (or `postgres`) + `drizzle-kit` (dev) — typed, parameterised DB access.
- `web-push` — VAPID push send.
- `zod` — input validation (SR-6, SR-3, SR-11).

Justified extras:
- A small rate-limit helper (`@upstash/ratelimit` + Upstash Redis **or** a lightweight in-DB counter) — needed for SR-9; prefer the in-DB counter first to avoid adding a vendor, escalate to Upstash only if load demands.
- Optionally `tailwindcss` (dev) — styling speed only; not load-bearing.

Explicitly avoided: OneSignal/Firebase SDKs, moment/large date libs (use `Intl`/`Temporal`-style native or `date-fns` only if needed), any UI component mega-kit.

## 8. Deployment steps

1. Push repo to GitHub; import into Vercel (framework auto-detected as Next.js).
2. Provision **Vercel Postgres**; Vercel injects `DATABASE_URL` automatically.
3. Generate a **VAPID keypair** locally with `web-push generate-vapid-keys`.
4. In Vercel **Project → Settings → Environment Variables** (Production + Preview), set: `AUTH_SECRET`, auth provider ID/secret (or email server creds for magic link), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` address), and `CRON_SECRET` (a long random value). Expose the public key to the client via `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. No secret is ever placed in code.
5. Add the schedule in `vercel.json` pointing Vercel Cron at `/api/cron/dispatch`; Vercel automatically attaches the `CRON_SECRET` as the bearer token per SR-7.
6. Run Drizzle migrations against the production DB (via a one-off command or a guarded migration route).
7. Deploy. On the phone, open the site in Safari/Chrome → **Add to Home Screen** (required for iOS push) → grant notification permission → verify a test dispatch arrives.
8. Confirm HTTPS + security headers (SR-13) on the live domain.

## 9. Build order

1. **Scaffold** Next.js + TS + PWA manifest + service worker skeleton. *(SR-13 headers, SR-1 env wiring via `env.ts`)*
2. **DB schema + migrations** (`users`, `habits`, `checkins`, `push_subscriptions`, `notification_log`). *(SR-4 shape)*
3. **Auth** with Auth.js, httpOnly sessions, protect `/api/**`. *(SR-5)*
4. **Habit CRUD API** with zod validation and user-scoped queries. *(SR-4, SR-6, SR-10)*
5. **Today view + one-tap check-in** with server-side streak calc. *(SR-2, SR-4)*
6. **Push subscribe/unsubscribe** endpoints + service-worker `push`/`notificationclick`. *(SR-3, SR-11)*
7. **Nudge engine** (quiet hours, timezone, timing jitter, rotating implementation-intention message variants, escalation + daily backoff, dedupe via `notification_log`). *(SR-11)*
8. **Cron dispatch endpoint**, bearer-gated, calling the engine + `web-push`, deleting dead subs. *(SR-7, SR-8)*
9. **Rate limiting** on write endpoints. *(SR-9)*
10. **Onboarding (<60s)**, forgiving streak UI, install prompt, quiet-hours settings. *(engagement mechanics)*
11. **Security pass**: CSP + headers, `npm audit`, client-bundle secret grep, ownership fuzz tests. *(SR-1, SR-2, SR-12, SR-13, and verify SR-4/SR-7)*

## 10. Open risks

**Biggest technical risk: iOS web-push reliability.** Research is clear that iOS push works **only** for home-screen-installed PWAs, has **no background sync**, and subscriptions have been observed to **silently expire after 1–2 weeks**, requiring re-subscribe. For an app whose entire value is *reliable* reminders reaching someone who already tunes out reminders, silent push death is fatal. **Mitigations built in:** detect stale/expired subscriptions on every app open and transparently re-subscribe; surface a gentle "notifications need a tap to re-enable" state; prefer **Declarative Web Push** (Safari 18.4+) which sidesteps the silent-push throttling penalty; and log delivery so we can measure real-world drop-off.

**What would falsify this approach:** if measured push delivery on iOS drops below a usable threshold (e.g. reminders regularly fail to arrive within their window, or re-subscription can't be made reliable), then the PWA notification channel is insufficient and the plan should pivot to a **native (or Capacitor-wrapped) app using APNs/FCM**, or a fallback channel such as scheduled email/SMS. The rest of the architecture (Postgres schema, auth, nudge engine, cron dispatch) is channel-agnostic and would survive that pivot — only the delivery leg changes.

---

**Relevant absolute paths (to be created by the builder):**
- Plan target root: `C:\Users\Amir_\projects\adhd-habit-tracker`
- Core engine: `C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\nudge-engine.ts`
- Push send + cleanup: `C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\push.ts`
- Cron fan-out (bearer-gated): `C:\Users\Amir_\projects\adhd-habit-tracker\src\app\api\cron\dispatch\route.ts`
- Service worker: `C:\Users\Amir_\projects\adhd-habit-tracker\public\sw.js`
- Env validation/secret loader: `C:\Users\Amir_\projects\adhd-habit-tracker\src\lib\env.ts`
- Cron schedule: `C:\Users\Amir_\projects\adhd-habit-tracker\vercel.json`

Sources:
- [PWA iOS Limitations and Safari Support 2026 (MagicBell)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [The State of Declarative Web Push in 2026 (Aimtell)](https://aimtell.com/blog/state-of-declarative-web-push-2026)
- [Apple: Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [web-push (npm)](https://www.npmjs.com/package/web-push)
- [Build a push notifications server (web.dev)](https://web.dev/articles/codelab-notifications-push-server)
- [Implementation Intention and Reminder Effects on Behavior Change (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5730820/)
- [ADHD-Friendly Reminders: variable timing and habituation (Recallify)](https://recallify.ai/adhd-friendly-reminders/)
- [How to Build Habits with ADHD (Habi)](https://habi.app/insights/how-to-build-habits-with-adhd/)
</content>
</invoke>
