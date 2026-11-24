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
- **Logout vs closing a tab**: Closing the tab clears `sessionStorage` (and therefore the token), while cached academic data and settings remain in `localStorage` if **Remember me** is enabled. Clicking **Disconnect** revokes the active token with Google (`window.google.accounts.oauth2.revoke`) and wipes all user-scoped caches via `resetDatabase(email)`. On shared or public computers, always click **Disconnect** before leaving.

## 2. Per-User Data Isolation

- **Scoped storage keys**: Every `localStorage` cache key includes the user's lowercase email (`${baseKey}_${email}`), keeping accounts separated in shared browsers.
- **Drive sync allowlist**: Incoming keys from Google Drive `appDataFolder` are checked against `isSafeSyncKey` in `src/services/driveSync.js` before writing to `localStorage`.
- **Calendar isolation**: `calendarSync.js` tags Classroom Hub events with `extendedProperties` metadata so reconciliation only modifies or removes events created by Classroom Hub.
- **Companion extension bridge**: `extension/bridge.js` and `ClassroomContext` accept `window.postMessage` events only from the same window and explicit allowed origins (`https://classrooms-hub.vercel.app` and local Vite ports), and compare a one-way FNV-1a hash of the student's 13-digit ID (`hashStudentIdForBridge`) to prevent snapshots from one KMUTNB Reg account from overwriting a different Classroom Hub account.

## 3. XSS, Email, and URL Protections

- **JSX escaping**: Classroom text and user notes in React are rendered through JSX's default text escaping; `dangerouslySetInnerHTML` is not used. The companion extension's toast in `extension/regContent.js` renders fixed strings and numeric counts inside a Shadow DOM root.
- **Email MIME and HTML escaping**: Outbound Gmail messages in `NotificationService.js` and `GoogleRepository.js` escape all dynamic text with `escapeHtml()`, restrict course accent colors to a fixed hex allowlist (`getHexColor`), and strip `[\r\n]` from email headers.
- **URL validation**: External links from Classroom, Drive, YouTube, Forms, and KMUTNB SciBase pass through `sanitizeExternalUrl()` (`src/utils/sanitize.js`), which rejects `javascript:`, `data:`, and non-HTTP(S) schemes. Both `https:` and `http:` are allowed so university links without TLS still open.

## 4. Discord Webhooks and Google Apps Script

- Discord Webhook URLs are never stored in `VITE_*` build-time variables. Each user saves their own URL in Settings or the notification popover, stored per account in `localStorage` and synced privately to their Google Drive `appDataFolder`.
- `DiscordService.validateWebhookUrl` accepts only `https:` URLs targeting official Discord webhook hosts and valid `/api/webhooks/{id}/{token}` paths. The UI masks tokens via `DiscordService.maskWebhookUrl`.
- Note that copying the optional 24/7 Google Apps Script from Settings embeds the user's Discord Webhook URL into the generated script text. Treat copied scripts like a secret and do not share them publicly.

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

- **Authentication & Input Validation**: Only `GET` requests carrying an active Google OAuth token issued for this app (`aud`/`azp` checked against Google `tokeninfo`) and an exact 13-digit `IDcard` are forwarded. Extra query parameters, caller `Authorization`, and `Cookie` headers are stripped before contacting the university endpoint.
- **Origin & Rate Limiting**: Cross-site browser requests and disallowed `Origin`/`Referer` headers are rejected (`403`). Successful callers are rate-limited (20 req/min per signed-in user and 60 req/min per IP, using Upstash Redis REST when configured or an in-memory fallback otherwise).
- **Known Upstream HTTP Limitation**: The Vercel-to-university connection (`http://www.scibase.kmutnb.ac.th/examroom/datatrain.php`) still uses plain HTTP with the Student ID in the query string. While Browser-to-Vercel traffic uses HTTPS, that upstream leg is not encrypted, and URL query strings may appear in upstream server or proxy logs.

Because the frontend cannot upgrade a third-party server to HTTPS, the Exam Room page displays a warning banner before the lookup UI, and automatic lookup can be turned off at any time via `EXAM_CONFIG.seatingLookupEnabled` in `src/config/exam.js` while keeping Reg import and manual exams available.

## Reporting a Vulnerability

If you find a security issue in CH Classroom Hub, please do not open a public issue. Email `kitipongzaza566@gmail.com` directly with reproduction details.
