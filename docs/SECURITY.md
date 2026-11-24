# Security Policy & Architecture

CH Classroom Hub prioritizes the security and privacy of student data. This document outlines the security architecture, threat models, and mitigation strategies implemented in the application.

## 1. Authentication Strategy

The application uses Google's OAuth 2.0 implementation via the Google Identity Services (GIS) SDK (`window.google.accounts.oauth2.initTokenClient`).

### OAuth Token Client Flow
- We utilize the client-side GIS Token Client flow, which returns a short-lived `access_token` (~1 hour) directly to browser memory without exposing client secrets or requiring a backend server.
- The `access_token` requests only the scopes required for student operations:
  - `https://www.googleapis.com/auth/classroom.courses.readonly`
  - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
  - `https://www.googleapis.com/auth/classroom.announcements.readonly`
  - `https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly`
  - `https://www.googleapis.com/auth/classroom.topics.readonly`
  - `https://www.googleapis.com/auth/drive.appdata`
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/gmail.send`
  - `openid`, `email`, `profile`

## 2. Token Storage & Lifecycle Management

Token security is critical for a frontend-only application:

- **In-Memory & Session Storage Only:** The Google OAuth token is kept in React state (`AuthContext`) and `sessionStorage` (`classroom_hub_access_token`) with an explicit expiration timestamp (`classroom_hub_access_token_expires_at`) and a 60-second clock-skew guard.
- **No LocalStorage for Tokens:** Raw OAuth tokens are never stored in `localStorage`.
- **Server-Side Revocation & Full Wipe on Logout:** On explicit logout, the app invokes `window.google.accounts.oauth2.revoke(accessToken)` and scrubs all user-scoped caches from `localStorage` via `resetDatabase(email)`.

## 3. Data Scoping & Multi-User Segregation

To support multiple Google Accounts sharing the same browser safely:

- All user-scoped keys in `localStorage` are formatted as `${baseKey}_${email}` (e.g., `classroom_hub_assignments_student@kmutnb.ac.th`) via `StorageRepository.getCacheKey`.
- Google Drive `appDataFolder` payloads are validated against a strict key allowlist (`isSafeSyncKey` in `src/services/driveSync.js`) before being applied to `localStorage`.
- Companion Chrome/Edge Extension (`extension/`) snapshots are restricted to explicit application origins (`https://classrooms-hub.vercel.app` and local dev ports) and bound to a one-way FNV-1a hash of the student's 13-digit Student ID (`hashStudentIdForBridge`) to prevent cross-account overwrites.

## 4. XSS & Injection Protection

- **React JSX Escaping:** All user-generated and Classroom content is rendered through React's default text escaping; `dangerouslySetInnerHTML` is never used.
- **URL Validation:** All external links from Google Classroom, Drive, YouTube, Forms, and KMUTNB SciBase are validated via `sanitizeExternalUrl()` (`src/utils/sanitize.js`), permitting only `https:` and `http:` schemes.
- **Email HTML & MIME Escaping:** Outbound Gmail notification templates escape all dynamic text via `escapeHtml()`, restrict course accent colors to a fixed hex allowlist (`getHexColor`), and strip `[\r\n]` from MIME headers.

## 5. Secret Management

- The application is a client-side Single Page Application (SPA).
- Only public identifiers (such as `VITE_GOOGLE_CLIENT_ID`) may use the `VITE_` build-time prefix.
- User-specific credentials such as personal Discord Webhook URLs must **never** be placed in `VITE_*` environment variables; they are configured per user in Settings, masked in the UI (`DiscordService.maskWebhookUrl`), and synced privately to each user's Google Drive `appDataFolder`.

## 6. Content Security Policy (CSP) & Security Headers

Production deployments on Vercel enforce strict security headers in `vercel.json`:
- `Content-Security-Policy` restricting `script-src` to `'self' https://accounts.google.com` and `frame-ancestors 'none'`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Reporting a Vulnerability

If you discover a security vulnerability within CH Classroom Hub, please do not disclose it publicly.
Instead, send an email to the repository owner at [kitipongzaza566@gmail.com]. All security issues will be treated with the highest priority and addressed swiftly.
