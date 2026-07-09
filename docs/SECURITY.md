# Security Policy & Architecture

CH Classroom Hub prioritizes the security and privacy of student data. This document outlines the security architecture, threat models, and mitigation strategies implemented in the application.

## 1. Authentication Strategy

The application uses Google's OAuth 2.0 implementation via the `@react-oauth/google` library and Google Identity Services (GIS).

### OAuth Implicit Flow
- We utilize the client-side Implicit Flow (or token flow), which directly returns an `access_token` to the browser memory without exposing client secrets or requiring a backend server.
- The `access_token` grants read-only scopes strictly required for operations:
  - `https://www.googleapis.com/auth/classroom.courses.readonly`
  - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
  - `https://www.googleapis.com/auth/classroom.announcements.readonly`
  - `https://www.googleapis.com/auth/classroom.student-submissions.me.readonly`
  - `https://www.googleapis.com/auth/drive.appdata`

## 2. Token Storage & Management

Token security is critical for a frontend-only application.

- **In-Memory Storage First:** The Google OAuth token is kept entirely in JavaScript memory (React State Context) whenever possible.
- **Session Storage:** For page reloads, the token is temporarily persisted to `sessionStorage`. It is automatically destroyed when the user closes the browser tab. 
- **NO LocalStorage for Tokens:** We strictly forbid saving raw OAuth tokens in `localStorage` to prevent exposure via persistent Cross-Site Scripting (XSS) vectors.

## 3. Data Scoping & Segregation

To support multiple Google Accounts sharing the same device, all persistent settings and cached data stored in `localStorage` are heavily scoped.

- Keys are structured as: `[USER_EMAIL]:[DATA_KEY]` (e.g., `student@kmutnb.ac.th:assignments`).
- This prevents Data Leakage across sessions, ensuring User A never sees User B's coursework.

## 4. XSS (Cross-Site Scripting) Protection

The application renders user-generated content from Google Classroom (e.g., assignment descriptions and announcements). To mitigate XSS:

- We use **DOMPurify** to rigorously sanitize all raw HTML payloads retrieved from Classroom before injection into the React Virtual DOM via `dangerouslySetInnerHTML`.
- React's default text escaping natively mitigates XSS for non-HTML string fields.

## 5. Secret Management

- The application is a Single Page Application (SPA), meaning it fundamentally runs on the client.
- We **never** hardcode API keys or secrets in the source code.
- Environmental variables (e.g., `VITE_GOOGLE_CLIENT_ID`) are used for public identifiers during build time, preventing accidental commits of sensitive configuration files.

## 6. Content Security Policy (CSP)

While not natively enforced via meta tags in development, the production deployment recommends configuring the reverse proxy (or Vercel) to emit a strict CSP header, only allowing scripts from self and Google domains.

## Reporting a Vulnerability

If you discover a security vulnerability within CH Classroom Hub, please do not disclose it publicly.
Instead, send an email to the repository owner at [kitipongzaza566@gmail.com]. All security issues will be treated with the highest priority and addressed swiftly.
