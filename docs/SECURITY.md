# Security Policy and Architecture

CH Classroom Hub is a client-side web application with no custom backend. This document describes how authentication, local data, external links, and third-party connections are handled, along with known transport limitations.

## 1. Authentication and Tokens

The app uses the Google Identity Services (GIS) Token Client (`window.google.accounts.oauth2.initTokenClient`).

- **Short-lived tokens**: Login returns an OAuth `access_token` (~1 hour lifetime) without storing a client secret or persistent refresh token.
- **Session-only token storage**: The `access_token` is held in React state (`AuthContext`) and `sessionStorage` (`classroom_hub_access_token`) alongside `classroom_hub_access_token_expires_at` with a 60-second clock-skew guard. It is never written to `localStorage`.
- **Scopes requested**:
  - Read-only Classroom scopes: `classroom.courses.readonly`, `classroom.coursework.me.readonly`, `classroom.announcements.readonly`, `classroom.courseworkmaterials.readonly`, `classroom.topics.readonly`
  - Sync and alerts: `drive.appdata`, `calendar.events`, `gmail.send`
  - Identity: `openid`, `email`, `profile`
- **Logout vs closing a tab & Public PC Mode (`Remember me` unchecked)**:
  - When **Remember me** is **unchecked**, `StorageRepository` switches to ephemeral `sessionStorage` so academic grades, Student IDs, exam seating, and Discord Webhook URLs never touch persistent `localStorage` on disk and vanish automatically when the tab closes.
  - When **Remember me** is **enabled** (default for personal devices), closing the tab clears `sessionStorage` (and therefore the OAuth token) while retaining the remembered account card on the Sign-In gate for one-click re-login and auto-sync.
  - Clicking **Disconnect** revokes the active token with Google (`window.google.accounts.oauth2.revoke`), wipes all user-scoped caches via `resetDatabase(email)`, and dispatches `CLEAR_EXTENSION_CACHE` to wipe any cached KMUTNB Reg snapshots in the companion extension.
- **Verified Account Isolation**: Interactive sign-in defers Google Drive `appDataFolder` sync and exam seating sync until `ClassroomService.fetchProfile` verifies the token owner's email (`verified_email` binding), preventing cross-account contamination when switching accounts.

## 2. Per-User Data Isolation

- **Scoped storage keys**: Every `localStorage` cache key includes the user's lowercase email (`${baseKey}_${email}`), keeping accounts separated in shared browsers.
- **Drive sync allowlist**: Incoming keys from Google Drive `appDataFolder` are checked against `isSafeSyncKey` in `src/services/driveSync.js` before writing to `localStorage`.
- **Calendar isolation & event privacy**: `calendarSync.js` tags Classroom Hub events with `extendedProperties.private` metadata so reconciliation only modifies or removes events created by Classroom Hub, and sets `visibility: 'private'` on all synced class, exam, and assignment events so shared/public primary calendars only show `Busy` to external viewers rather than exposing exam rooms or seat numbers.
- **Companion extension bridge**: `extension/bridge.js` and `ClassroomContext` accept `window.postMessage` events only from the same window and explicit allowed origins (`https://classrooms-hub.vercel.app` and local Vite ports), enforce a 24-hour TTL on captured snapshots, scrub raw grade/timetable text from `chrome.storage.local` immediately upon `ACK_SYNC_COMPLETE`, block auto-import when the logged-in account has no verified 13-digit Student ID, and compare a one-way FNV-1a hash (`hashStudentIdForBridge`) to prevent cross-account overwrites.

## 3. XSS, Email, and URL Protections

- **JSX escaping**: Classroom text and user notes in React are rendered through JSX's default text escaping; `dangerouslySetInnerHTML` is not used. The companion extension's toast in `extension/regContent.js` renders fixed strings and numeric counts inside a Shadow DOM root.
- **Email MIME and HTML escaping**: Outbound Gmail messages in `NotificationService.js` and `GoogleRepository.js` escape all dynamic text with `escapeHtml()`, restrict course accent colors to a fixed hex allowlist (`getHexColor`), and strip `[\r\n]` from email headers.
- **URL validation**: External links from Classroom, Drive, YouTube, Forms, and KMUTNB SciBase pass through `sanitizeExternalUrl()` (`src/utils/sanitize.js`), which rejects `javascript:`, `data:`, and non-HTTP(S) schemes. Both `https:` and `http:` are allowed so university links without TLS still open.

## 4. Discord Webhooks and Google Apps Script

- Discord Webhook URLs are never stored in `VITE_*` build-time variables. Each user saves their own URL in Settings or the notification popover, stored per account and synced privately to their Google Drive `appDataFolder` unless the user disables `syncWebhookToDrive` to keep the webhook secret strictly on the current device.
- `DiscordService.validateWebhookUrl` accepts only `https:` URLs targeting official Discord webhook hosts and valid `/api/webhooks/{id}/{token}` paths. The UI masks tokens via `DiscordService.maskWebhookUrl`, and `DiscordService.scrubSecrets` strips any webhook token from error strings and telemetry before logging or persisting.
- **24/7 Google Apps Script Secret Isolation**: By default, the generated `Code.gs` template in Settings does **not** embed the user's Discord Webhook URL in source code (`embedWebhookInScript: false`). Instead, it reads `DISCORD_WEBHOOK_URL` from Google Apps Script `PropertiesService.getScriptProperties()`. If a user explicitly enables the opt-in embed toggle for one-step pasting, they should treat the copied script as a secret and never share it publicly.
- **Synced Timetable & Exam Metadata**: Background Apps Script schedule and exam alerts read Classroom Hub events from the user's own Google Calendar (`extendedProperties.private` with `chSource=classroom-hub`) using existing `calendar.events` permissions, avoiding custom external databases or storing student portal credentials/tokens.

## 5. Content Security Policy and Security Headers

Production deployments on Vercel apply these headers in `vercel.json`:

- `Content-Security-Policy`: Restricts scripts to `'self' https://accounts.google.com`, connections to `'self'`, Google APIs, and official Discord webhook domains, frames to `https://accounts.google.com`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, and `object-src 'none'`.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 6. Exam Seating Proxy Controls and Known HTTP Limitation

Automatic exam-room lookup requests `GET /api/exam-room?IDcard={studentId}` with the signed-in user's Google OAuth `access_token` (`Authorization: Bearer ...`). On Vercel production deployments, requests run through the serverless function `api/exam-room.js` rather than an open edge rewrite:

- **Authentication, Ownership Lock & Input Validation**: Only `GET` requests carrying an active Google OAuth token issued for this app (`aud`/`azp` checked against Google `tokeninfo`) and an exact 13-digit `IDcard` are forwarded. University Google accounts (`s{13digits}@email.kmutnb.ac.th`) are strictly locked (`403`) to their own 13-digit Student ID, while personal accounts without numeric email IDs are pinned to a single Student ID to block cross-student IDOR enumeration. Extra query parameters, caller `Authorization`, and `Cookie` headers are stripped, upstream responses are capped at 2 MB (`text/html`/`text/plain` only), and proxied HTML is returned with `Content-Security-Policy: default-src 'none'; sandbox` and `X-Frame-Options: DENY`.
- **Origin & Rate Limiting**: Cross-site browser requests and disallowed `Origin`/`Referer` headers are rejected (`403`). Successful callers are rate-limited (20 req/min per signed-in user and 60 req/min per IP, using Upstash Redis REST when configured or an in-memory fallback otherwise).
- **Known Upstream HTTP Limitation**: The Vercel-to-university connection (`http://www.scibase.kmutnb.ac.th/examroom/datatrain.php`) still uses plain HTTP with the Student ID in the query string. While Browser-to-Vercel traffic uses HTTPS, that upstream leg is not encrypted, and URL query strings may appear in upstream server or proxy logs.

Because the frontend cannot upgrade a third-party server to HTTPS, the Exam Room page displays a warning banner before the lookup UI, and automatic lookup can be turned off at any time via `EXAM_CONFIG.seatingLookupEnabled` in `src/config/exam.js` while keeping Reg import and manual exams available.

## Reporting a Vulnerability

If you find a security issue in CH Classroom Hub, please do not open a public issue. Email `kitipongzaza566@gmail.com` directly with reproduction details.
