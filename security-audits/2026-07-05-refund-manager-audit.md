# Security Audit — Refund Manager CRM ("TaxPro CRM")

- **Date:** 2026-07-05
- **Scope:** `server/`, `shared/schema.ts`, `client/src/`, `package.json`, migrations
- **Target:** Production tax-refund CRM (Eden Asulin, CPA — Israel). Real client PII: names, phones, tax IDs, ID document numbers, refund amounts, uploaded ID cards / tax forms / salary slips.
- **Stack:** Node + Express 5 + Passport(local) + Drizzle/Postgres + Supabase Storage, on Railway.
- **Method:** Static source review. No source code was modified. No live exploitation performed.

---

## Executive summary

The application has **strong HMAC verification on the lead webhook** and correctly uses Drizzle parametrized queries (no SQL injection found) and React auto-escaping (no meaningful stored XSS). However, the **authorization model is broken**: the `requireAuth` guard treats every logged-in user identically, so the low-trust `partner` role — seeded with a password committed to the repo (`Partner2026!`) — can read the entire client database, every uploaded document, and the raw webhook PII log. In addition, **~7 unauthenticated `/api/debug/*` and diagnostic endpoints** leak PII and allow email abuse, the **Twilio inbound endpoint has no signature check** and can be forged to query client data, and **default admin credentials** (`TaxPro2026!`) are hardcoded as a fallback. There is **no rate limiting anywhere** (login brute-force, webhook flooding).

**Counts:** Critical: **5** · High: **6** · Medium: **7** · Low/Info: **8**

Because this holds HIPAA-level-sensitive tax data, the Critical items should be treated as an active incident (rotate the seeded/default passwords and the shared bot token today).

---

## Findings by severity

### CRITICAL

---

#### C-1. `partner` role can read the entire CRM — `requireAuth` performs authentication but not authorization
- **Severity:** Critical
- **Location:** `server/auth.ts:252-258` (`requireAuth`); applied to nearly every data route in `server/routes.ts` (e.g. `:70` `/api/clients`, `:80` `/api/clients/:id`, `:984` `/api/documents/:id/download`, `:693` `/api/webhook-events`, `:537` `/api/bot/weekly-business`).
- **Scenario:** The `partner` role is meant to be sandboxed to the Partner Dashboard (`requirePartner`, ownership-checked). But `requireAuth` only calls `req.isAuthenticated()` — a partner session passes it. So an authenticated partner can call `GET /api/clients` and receive **every client** with `taxId`, `idDocumentNumber`, `refundPaidToClient`, phone, email, address; `GET /api/documents/:id/download` to pull **any** client's ID card / salary slip; `GET /api/webhook-events` to read raw lead PII; and `GET /api/bot/weekly-business` for the full business report. This is a full confidentiality breach for the lowest-trust role. Combined with C-2 (known partner password) it is remotely exploitable with no insider access.
- **Fix:** Change all owner/admin data routes from `requireAuth` to `requireOwner` (which already blocks `partner`). Audit every route in `routes.ts` and pick the correct guard explicitly. Consider a default-deny wrapper. `requireAuth` should be reserved only for routes genuinely meant for all roles.

#### C-2. Hardcoded default / seeded credentials
- **Severity:** Critical
- **Location:** `server/seed.ts:6,34-36`
- **Scenario:** `INITIAL_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || "TaxPro2026!"`. Both admin accounts (`eliazasulin@gmail.com`, `edenabergel94@gmail.com`) are seeded with this fallback if `INITIAL_ADMIN_PASSWORD` is unset, and the partner (`partner@taxpro.local`) is seeded with the literal `"Partner2026!"`. These strings are in the repo. An attacker who reads the source (or guesses) can log in as **admin** at the public URL unless the passwords were manually changed post-seed. The partner password is a fixed literal with no override at all.
- **Fix:** Never commit default passwords. Generate a random password at seed time, print it once to logs, and force a change on first login. Remove `partner@taxpro.local` if unused, or give it a random password. Confirm the two admin accounts have had their passwords rotated away from `TaxPro2026!` in production **now**.

#### C-3. Unauthenticated debug/diagnostic endpoints leak PII and allow email abuse
- **Severity:** Critical
- **Location:** `server/index.ts:89-205` — `GET /api/debug/email-reminder-status`, `POST /api/debug/send-test-email`, `POST /api/debug/send-reminder-now/:id`, `POST /api/debug/run-email-scheduler`. None have any auth guard.
- **Scenario:**
  - `GET /api/debug/email-reminder-status` returns reminder contents, timestamps and scheduler error/stack to anyone — reminders contain client-related free text.
  - `POST /api/debug/run-email-scheduler` and `send-reminder-now/:id` cause the server to send reminder emails on demand (containing client name + phone) to `REMINDER_EMAIL_TO`; an attacker can force-drain the Resend quota / spam the CPA's inbox and trigger enumeration of reminder IDs.
  - `POST /api/debug/send-test-email` lets any anonymous caller burn Resend send quota repeatedly (DoS / cost).
- **Fix:** Delete these endpoints in production, or gate them behind `requireOwner` **and** a server-side environment flag (`if (process.env.NODE_ENV !== 'production')`). At minimum stop returning `err.stack`.

#### C-4. Twilio WhatsApp inbound endpoint has no signature verification — forgeable to query client data
- **Severity:** Critical
- **Location:** `server/routes.ts:700-719` + command handler `:725-791`
- **Scenario:** `POST /api/twilio/whatsapp-inbound` is public and does **not** validate `X-Twilio-Signature`. Authorization is only a string check that the `From` field ends with `WHATSAPP_OWNER_PHONE`. Since the request body is fully attacker-controlled (no Twilio HMAC), an attacker simply POSTs `From=whatsapp:+972506007165&Body=לידים` (or `לקוחות` / `חפש <name>` / `סטטוס`) and the endpoint replies with real lead names + phone numbers, active-client names, and revenue stats. The owner phone number is effectively public, so this is a data-exfiltration channel requiring no credentials.
- **Fix:** Verify the Twilio signature using `twilio.validateRequest(authToken, signature, url, params)` on every inbound call and reject on mismatch. Treat the `From` allow-list as a secondary check only. If the Twilio bot is superseded (comment says "old bot"), remove the route entirely.

#### C-5. Shared bot token grants full admin and lets the caller pick any identity
- **Severity:** Critical
- **Location:** `server/auth.ts:225-258` (`checkBotToken`, honored by both `requireAuth` and `requireOwner`)
- **Scenario:** Any request carrying `X-Bot-Token: <BOT_API_TOKEN>` is elevated to `role: "admin"` on every guarded route, and the caller freely selects the acting identity via the unauthenticated `X-Bot-User` header (`eden` / `eliezer`). The same secret is stored in a **second** Railway service (gmail-agent env: `REFUND_MANAGER_BOT_API_TOKEN`), widening the blast radius: a compromise of the Gmail Agent service, or any log/proxy that captured the header, yields full admin over the CRM including document downloads and client deletion. There is no scoping — the bot token is not limited to the read-only `/api/bot/*` reporting endpoints it exists for.
- **Fix:** Scope the bot token to only the specific read endpoints it needs (a dedicated middleware on `/api/bot/*`), not a blanket admin bypass on `requireOwner`/`requireAuth`. Do not let the client choose identity via a plain header. Rotate `BOT_API_TOKEN` now (it lives in two services). Consider mTLS or Railway private-network-only exposure.

---

### HIGH

---

#### H-1. Full PII written to Railway application logs
- **Severity:** High
- **Location:** `server/index.ts:54-63` (response body logger) and `server/routes.ts:384,459` (webhook raw body / mapped payload)
- **Scenario:** The global logger appends `JSON.stringify(capturedJsonResponse)` for every non-`/api/auth` API response (`index.ts:58-60`). So `GET /api/clients` dumps **every client record — tax IDs, ID document numbers, phones, refund amounts — into stdout/Railway logs**, which are retained and viewable by anyone with Railway project access (and were shared into this audit's env dump tooling). The lead webhook additionally logs `rawBodyStr.substring(0,600)` and the mapped payload including `tax_id` and `phone` (`routes.ts:384,459`). Logs are a lower-trust store than the DB and are not access-controlled to the same standard.
- **Fix:** Never log full response bodies in production. Redact PII fields, log only counts/IDs, or disable the `:: <json>` branch when `NODE_ENV==="production"`. Remove raw-body and tax_id logging from the webhook path.

#### H-2. No rate limiting on login → password brute force & credential stuffing
- **Severity:** High
- **Location:** `server/auth.ts:98-118` (login); no `express-rate-limit`/`helmet` present in `package.json`.
- **Scenario:** `POST /api/auth/login` can be called unlimited times. With a small admin user set and human-memorable passwords, offline-speed online guessing is feasible. Same lack of throttling enables webhook flooding (H-3) and reset-token spraying.
- **Fix:** Add `express-rate-limit` (e.g. 5–10 attempts / 15 min / IP+email) on login, plus a global limiter. Consider account lockout/backoff and a CAPTCHA after N failures.

#### H-3. No rate limiting / anti-flood on the lead webhook
- **Severity:** High
- **Location:** `server/routes.ts:365-534`, `:688-690`
- **Scenario:** HMAC prevents forged *content*, but there is no per-IP throttle. An attacker who obtains `LEAD_WEBHOOK_SECRET` (or replays — see M-2) can create unbounded client rows and, worse, every failed attempt still writes a full `webhook_events` audit row (`storage.createWebhookEvent` runs *before* auth at `routes.ts:388`). Anonymous callers with a bad/absent signature therefore still fill the `webhook_events` table (unbounded DB growth + each failure persists their raw headers/body). This is a cheap storage-exhaustion / cost DoS.
- **Fix:** Rate-limit the webhook per IP. Only persist audit rows for requests that at least present a signature, or cap/rotate `webhook_events`. Add a size cap on stored `rawBody`.

#### H-4. Any authenticated user can download any client's documents (IDOR by role)
- **Severity:** High
- **Location:** `server/routes.ts:984-994` (`GET /api/documents/:id/download`, guard `requireAuth`)
- **Scenario:** This "admin" download route only checks authentication, does no per-user ownership check, and looks the document up by ID alone. A `partner` (or any user role) — see C-1 — can iterate document IDs and pull ID cards, salary slips and tax forms for clients they have no relationship with. The parallel partner route (`:928-942`) *does* enforce ownership, which shows the check was omitted here.
- **Fix:** Change guard to `requireOwner`, and/or verify the requesting user is entitled to the document's client. Prefer server-streamed download with an authorization check over handing out a signed Supabase URL.

#### H-5. Uploaded files are not type/content validated (arbitrary file upload)
- **Severity:** High
- **Location:** `server/routes.ts:39-42,951-982`; `server/supabaseStorage.ts:22-39`
- **Scenario:** Multer accepts any MIME type / extension up to 20 MB; `contentType` is taken from the client-supplied `file.mimetype` and stored verbatim. No magic-byte check, no allow-list, no AV scan. A malicious `.html`/`.svg` uploaded as a "document" is later served from a Supabase signed URL with the attacker's content-type — enabling script execution on the Supabase storage origin, phishing pages hosted under the CPA's trusted flow, or malware distribution to staff who open "client documents".
- **Fix:** Enforce an allow-list of expected types (`application/pdf`, `image/jpeg`, `image/png`) validated by magic bytes (e.g. `file-type`), reject others, and force `Content-Disposition: attachment` / a neutral `application/octet-stream` on download. Add AV scanning if budget allows.

#### H-6. No security headers (helmet/CSP) on the app
- **Severity:** High (aggregate) / Medium individually
- **Location:** `server/index.ts` (no `helmet`), `server/static.ts` (only cache headers)
- **Scenario:** No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or HSTS are set. Absent CSP, any XSS foothold (e.g. via H-5 content, or a future `dangerouslySetInnerHTML` change) is unconstrained; absent `X-Frame-Options`, the dashboard is clickjackable. `chart.tsx:81` already uses `dangerouslySetInnerHTML` (currently config-driven, low risk, but no CSP backstop).
- **Fix:** Add `helmet()` with a locked-down CSP, HSTS, `frameguard: deny`, `noSniff`. Test against the Vite bundle.

---

### MEDIUM

---

#### M-1. Session store is in-memory (`memorystore`), not Postgres
- **Severity:** Medium
- **Location:** `server/auth.ts:27-28`
- **Scenario:** Despite `connect-pg-simple` being a dependency, auth uses `MemoryStore`. On Railway, every deploy/restart/crash wipes all sessions (users logged out — availability), and on a multi-instance scale-up sessions won't be shared (broken auth). Memory also grows with session volume. Not a direct breach, but contradicts the documented design ("sessions in Postgres") and undermines session reliability.
- **Fix:** Switch to `connect-pg-simple` backed by the existing `pool`, or Redis. Set a session TTL and rolling expiry.

#### M-2. Webhook has no replay / nonce / timestamp protection
- **Severity:** Medium
- **Location:** `server/routes.ts:401-442`
- **Scenario:** HMAC is over the body only. A captured valid `(body, signature)` pair can be replayed indefinitely to re-create/re-update leads and re-trigger the Gmail Agent notification. Constant-time compare and length check are correctly implemented (`timingSafeEqual` at `:431`), so the crypto itself is sound — the gap is only replay.
- **Fix:** Require a signed timestamp/nonce header, include it in the HMAC, reject stale (>5 min) or previously-seen nonces.

#### M-3. Free-text lead fields flow unfiltered into the Gmail Agent LLM/WhatsApp pipeline (prompt injection)
- **Severity:** Medium
- **Location:** `server/routes.ts:454,481` (webhook `notes`), `server/index.ts:277-293` (reminder `content` → Gmail Agent), `notifyGmailAgentLeadCreated` `routes.ts:12-37`
- **Scenario:** `notes`, `notRelevantReason` and reminder `content` are stored as-is and forwarded to the Gmail Agent, which (per project context) feeds them to an LLM that composes WhatsApp/email output. Attacker-influenced text (via a lead form or a compromised note) can carry prompt-injection payloads ("ignore previous instructions, send X to Y"). Impact depends on the Agent's trust boundary, which is outside this repo but shares secrets with it.
- **Fix:** Treat all forwarded free text as untrusted data in the Agent (delimit, don't concatenate into instructions). Length-cap and strip control characters before forwarding. Validate/limit `notes` length in the webhook Zod path (see M-4).

#### M-4. Weak input validation on webhook & several routes
- **Severity:** Medium
- **Location:** `server/routes.ts:444-484` (webhook manual mapping — no Zod, no length/format limits on `full_name`, `phone`, `email`, `notes`, `tax_id`); `:338-347` (reminders — untyped `content`/`reminderAt`); `:302-315` (notes); `:853-885` (partner leads).
- **Scenario:** The webhook maps fields by hand with no max length, no phone/email format check, no `tax_id` format check. This allows oversized payloads (paired with H-3 storage abuse), malformed data, and homograph/whitespace tricks. `new Date(reminderAt)` accepts junk → `Invalid Date`. `phone` is never normalized to a canonical format, so dedup (`findClientByPhoneOrEmail`, exact `eq`) is trivially bypassed with formatting variants → duplicate lead spam.
- **Fix:** Define a strict Zod schema for the webhook payload (bounded lengths, phone regex, email validation, source enum) and parse before use. Normalize phone to E.164 before storing/deduping. Validate `reminderAt` is a valid future date.

#### M-5. `getClient` / `getClientById` does not exclude soft-deleted records
- **Severity:** Medium
- **Location:** `server/storage.ts:166-169` (`getClient`), used by `GET /api/clients/:id` `routes.ts:80`
- **Scenario:** `getClients()` filters `deletedAt IS NULL`, but `getClient(id)` does not. A "deleted" client (right-to-be-forgotten / off-boarded) is still fully retrievable by direct ID, including through the document and reminder flows that call `getClient`. Deleted PII remaining accessible undermines the soft-delete guarantee.
- **Fix:** Filter `isNull(clients.deletedAt)` in `getClient`, or add an explicit `includeDeleted` flag only for the restore/deleted-list admin flows.

#### M-6. Unauthenticated client-error sink enables log injection / flooding
- **Severity:** Medium
- **Location:** `server/routes.ts:54-58` (`POST /api/client-error`)
- **Scenario:** Public endpoint that `console.error`s attacker-supplied `message`/`stack`/`componentStack` unbounded. Enables log flooding (cost/retention), forged log entries (log injection, since values are concatenated with newlines), and obfuscation of real events.
- **Fix:** Rate-limit, cap field lengths, strip newlines, and consider requiring auth or a lightweight token.

#### M-7. Signed-URL download exposes documents via a bearer URL with no per-open auth
- **Severity:** Medium
- **Location:** `server/routes.ts:937,989`; `server/supabaseStorage.ts:41-45`
- **Scenario:** Downloads return a 60-second Supabase signed URL. The TTL is short (good), but the URL itself is an unauthenticated bearer capability — if it lands in a proxy log, browser history, or referer, anyone can fetch the tax document within the window. No download rate limiting exists either. Combined with H-4, ID enumeration produces a stream of signed URLs.
- **Fix:** Prefer proxying the file through the authenticated server rather than redirecting to a public signed URL; if keeping signed URLs, keep TTL minimal, avoid logging them, and add per-user download rate limits.

---

### LOW / INFO

- **L-1 (Low) — `SESSION_SECRET` is short (26 chars).** `server/auth.ts:33-37`. It is validated as present (good) but env dump shows only 26 chars. Ensure it's a high-entropy random value (≥32 bytes) and rotate on suspicion. Rotating invalidates sessions (acceptable given M-1).
- **L-2 (Low) — Password minimum length is 6.** `server/auth.ts:146,193`. Weak for admin accounts holding tax data. Raise to ≥12 and check against common-password lists.
- **L-3 (Low) — Legacy `LANDY_WEBHOOK_SECRET` and `/api/webhooks/landy` alias still accepted.** `server/routes.ts:404,690`. Extra valid secret + endpoint enlarge attack surface; retire once senders are migrated to `/api/webhooks/lead` + `LEAD_WEBHOOK_SECRET`.
- **L-4 (Low) — Password-reset delivery is non-functional in production.** `server/auth.ts:166-186`. Token is only `console.log`'d when `NODE_ENV!=="production"`, so in prod tokens are created but never delivered (users told to "contact admin"). Not a vuln (no enumeration — constant response; token is 32-byte random), but the `password_reset_tokens` table can accumulate unused rows and the flow is effectively dead. Wire up email delivery or remove the endpoints. `validate-reset-token` and login both correctly avoid user enumeration.
- **L-5 (Info) — `/api/users` returns all users (email, role, id) to any authenticated caller.** `server/routes.ts:65-68`. `passwordHash` is correctly stripped, but exposing the full user/role list to non-admins (incl. partners, per C-1) aids targeting. Restrict to `requireOwner`.
- **L-6 (Info) — Debug `stack` traces returned to clients on some endpoints.** `server/index.ts:122,203`. The global error handler (`:213-224`) correctly returns only `message`, but the debug routes leak `err.stack`. Removed once C-3 is fixed.
- **L-7 (Info) — N+1 queries in `/api/bot/weekly-business` and unbounded `getClients()`.** `server/routes.ts:588-618,537`. Per-client note fetches (40+15+15) plus full-table scans; at scale this is a slow-endpoint DoS lever. Add pagination / aggregate queries.
- **L-8 (Info) — `.migrations/` (009, 010) are not executed.** `server/migrations.ts:13` reads `migrations/` only; the `.migrations/` folder (gmail_accounts_and_bank, nlpearl_calls) is ignored. Not security-relevant, but a schema-drift footgun; consolidate migration dirs. Note also `db.execute(sql.raw(fileContents))` (`:34`) is safe here (trusted local files) but must never be pointed at user input.

---

## Coverage by requested area

### 1. Authentication & Session Management
- Login brute-force: **no rate limit (H-2)**. Enumeration: **none** — login and forgot-password return constant messages (good). Password reset: exists but **non-delivering in prod (L-4)**; tokens are strong 32-byte random, expiry + `used` enforced (good). Cookie flags: `httpOnly:true`, `secure` in prod, `sameSite:lax` (good). Bcrypt cost **12 (good)**. Bootstrap admin: **default password fallback (C-2)**. Cookie theft from another IP: sessions are not IP-bound — a stolen cookie works anywhere (inherent to cookie sessions; mitigated only by `secure`/`httpOnly`); acceptable but note **in-memory store (M-1)**. Partner vs Owner vs User separation: **defined but not enforced on data routes (C-1)**.

### 2. Authorization / RBAC
- **Broken (C-1)** — `requireAuth` = authn only; partners reach all owner data. Bot endpoints gated by `requireAuth` only → any authenticated user (incl. partner) can pull the weekly report and lead lists (**C-1/C-5**). Partner routes themselves *do* correctly scope by `partnerId` (`routes.ts:874-935`) — that part is good. Document access cross-user: **broken on the admin route (H-4)**. Sensitive fields (`taxId`, `idDocumentNumber`, `refundPaidToClient`) are returned in full API responses to all authenticated roles and **logged (H-1)**; no field-level protection.

### 3. Webhook Security
- LEAD HMAC: correct algorithm, `timingSafeEqual` **constant-time (good)**, length-checked. **No replay protection (M-2)**. Outbound Gmail Agent signing: HMAC-SHA256 over exact payload (good); rotation = env var swap (manual). Legacy `/landy` alias + `LANDY_WEBHOOK_SECRET` **still active (L-3)**. Twilio inbound: **no signature verification (C-4)**. Audit row written before auth → **abuse vector (H-3)**.

### 4. Input Validation & Injection
- SQL injection: **none found** — Drizzle parametrized throughout; the few `sql\`\`` fragments (`storage.ts:141,357-405,418-425`) use no interpolated user input; `migrations.ts` `sql.raw` is on trusted local files. Webhook validation: **weak/manual (M-4)**. XSS in dashboard: React auto-escapes `customStatus`/`notes`/`notRelevantReason`/`note.content` (`client-detail.tsx:352,716`), and the email builder uses `escapeHtml` (`email.ts:22-28,97-130`) — **no stored XSS found**. Prompt injection into Gmail Agent: **possible (M-3)**. Path traversal: upload path is sanitized (`supabaseStorage.ts:29` strips non-alphanumerics) and download is by DB id, not user path — **safe**. File type: **unrestricted (H-5)**. Phone normalization: **none (M-4)**.

### 5. Data Exposure
- Webhook audit stores raw body incl. phone/name, viewable via `/api/webhook-events` to all authenticated users (**C-1**) and written on failed/anon requests (**H-3**). Error stack traces to client: only on debug routes (**L-6**); global handler is clean. `console.log(rawBody.substring(0,600))` + full response-body logging → **PII in Railway logs (H-1)**. Diagnostic endpoints unauthenticated (**C-3**). Soft-deleted clients still retrievable by id (**M-5**).

### 6. Storage & Document Handling
- Signed URLs: 60s TTL (good) but bearer-capability with no per-open auth and logged risk (**M-7**). No AV/content-type verification (**H-5**). Bucket accessed with the **service-role key** (`supabaseStorage.ts:10`) — full bucket power server-side; ensure the bucket is **private** (not verifiable from code — confirm in Supabase). No download rate limiting (**M-7/H-3**).

### 7. Session & CSRF
- No CSRF tokens. **Risk is reduced** by `sameSite:lax` (blocks cookies on cross-site POST/PATCH/DELETE) — acceptable but add tokens/`sameSite:strict` for defense in depth on state-changing routes. **No CORS config** → same-origin only by default (good). No `helmet`/CSP (**H-6**).

### 8. DoS & Rate Limits
- **No rate limiting anywhere** (login H-2, webhook H-3, client-error M-6, document download M-7, debug email C-3). Unbounded `getClients()` and N+1 weekly report (**L-7**). Reminder poller runs every 60s and processes all pending rows unbounded (`index.ts:255,312`) — at 100k rows this blocks the loop and hammers Resend/Agent; add batching + `LIMIT`.

### 9. Dependencies
- Express **5.0.1** (early 5.x — bump to latest 5.x patch). No pinned known-critical CVE spotted in the manifest, but **no `npm audit` evidence and no rate-limit/helmet libs present**. `memorystore` used in prod (M-1). Recommend running `npm audit --production` in CI and adding `helmet` + `express-rate-limit`. `bcryptjs` (pure-JS) is fine but slower than native `bcrypt` — cost 12 is acceptable.

### 10. Frontend (client/src)
- `dangerouslySetInnerHTML` only in `ui/chart.tsx:81` (shadcn theme CSS from config, not user data — **low risk**, but no CSP backstop, H-6). No `localStorage`/`sessionStorage` of secrets found. No API tokens in the bundle (auth is cookie-based; `apiRequest` uses `credentials:"include"`, `queryClient.ts:19,32`). No CSP (**H-6**). React escaping protects rendered user content.

### 11. Bot-facing endpoints
- `/api/bot/weekly-business` is gated by `requireAuth` only — **no dedicated bot-token requirement**, so any authenticated user (incl. partner) can pull it and scrape enriched lead/payment/notes data (**C-1**). The `X-Bot-Token` path exists but as a blanket admin bypass, not a scoped read token (**C-5**). New fields `cohortFunnel`/`thisWeekActivity`/`avgResponseHours` are computed server-side from DB aggregates with **no URL-param input**, so no injection via params — the only issue is the missing authorization gate.

---

## Punch list (prioritized)

**Do today (active-incident class):**
1. **C-2 / C-5 / L-1:** Rotate the two admin passwords, the partner password, `BOT_API_TOKEN` (in both Railway services), and `SESSION_SECRET`. Confirm none still equal `TaxPro2026!` / `Partner2026!`.
2. **C-3:** Remove or auth-gate all `/api/debug/*` endpoints.
3. **C-1 / H-4 / L-5:** Switch owner/admin data routes (clients, documents, webhook-events, users, bot report, payments, cases, tasks, etc.) from `requireAuth` to `requireOwner`; add per-document ownership check.
4. **C-4:** Add Twilio signature verification (or delete the inbound route if superseded).

**This week:**
5. **H-1:** Stop logging full response bodies and raw webhook PII in production.
6. **H-2 / H-3 / M-6:** Add `express-rate-limit` (login, webhook, client-error, downloads); stop persisting audit rows for unsigned/anon webhook calls.
7. **H-5:** Enforce upload type allow-list (magic-byte checked) + `Content-Disposition: attachment` on download.
8. **H-6:** Add `helmet` with CSP/HSTS/frameguard.

**Soon:**
9. **M-1:** Move sessions to `connect-pg-simple`/Redis.
10. **M-2:** Add webhook replay protection (signed timestamp + nonce).
11. **M-4:** Strict Zod schema + phone E.164 normalization on the webhook.
12. **M-5:** Exclude soft-deleted clients from `getClient`.
13. **M-3 / M-7:** Sanitize free text forwarded to the Gmail Agent; proxy document downloads instead of redirecting to signed URLs.

**Backlog / hygiene:**
14. **L-2** raise password minimums; **L-3** retire the `landy` alias + legacy secret; **L-4** wire up or remove password reset; **L-7** paginate heavy endpoints; **L-8** consolidate migration dirs; run `npm audit` in CI; bump Express 5 patch.

---

*Report only — no source code was modified. Confirm the Supabase `crm-documents` bucket is private and that production admin passwords were rotated after seeding; both are not verifiable from source alone.*
