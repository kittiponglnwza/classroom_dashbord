# API Reference

CH Classroom Hub communicates directly with external REST APIs from the browser, except for the KMUTNB exam seating lookup which goes through a same-origin proxy path.

## 1. Google Classroom API (`https://classroom.googleapis.com/v1`)

All Classroom endpoints paginate with `GoogleRepository.fetchAllPages` using `pageSize=100` (capped at 50 pages with duplicate `pageToken` protection).

- **List Active Courses**: `GET /courses?studentId=me&courseStates=ACTIVE&pageSize=100`
  - Scope: `classroom.courses.readonly`
- **List Coursework**: `GET /courses/{courseId}/courseWork?pageSize=100`
  - Scope: `classroom.coursework.me.readonly`
- **List Student Submissions**: `GET /courses/{courseId}/courseWork/-/studentSubmissions?userId=me&pageSize=100`
  - Scope: `classroom.coursework.me.readonly`
  - Maps `TURNED_IN` and `RETURNED` states to `done`.
- **List Announcements**: `GET /courses/{courseId}/announcements?pageSize=100`
  - Scope: `classroom.announcements.readonly`
- **List Coursework Materials**: `GET /courses/{courseId}/courseWorkMaterials?pageSize=100`
  - Scope: `classroom.courseworkmaterials.readonly`
- **List Topics**: `GET /courses/{courseId}/topics?pageSize=100`
  - Scope: `classroom.topics.readonly`

## 2. Google Drive API (`appDataFolder`)

Stores a single JSON sync file named `classroom_hub_sync_settings.json` inside the user's hidden application data folder.

- **Scope**: `drive.appdata`
- **Find Sync File**: `GET https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=...&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`
- **Download Content**: `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
  - Skipped when both `file.modifiedTime` and the canonical local payload match the last synced snapshot in memory.
- **Create / Update**:
  - `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`
  - `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media&fields=id,modifiedTime`
- **Conflict Resolution**: `SyncManager.mergePayloads` merges each collection item-by-item using update timestamps and deletion tombstones before writing back.

## 3. Google Calendar API (`https://www.googleapis.com/calendar/v3`)

Pushes weekly class schedules, exam events, and pending assignment deadlines to the user's primary calendar.

- **Scope**: `calendar.events`
- **Endpoints**:
  - `GET /calendars/primary/events` (filtered to events tagged with Classroom Hub `extendedProperties` metadata so user-created personal events are untouched)
  - `POST /calendars/primary/events`
  - `PATCH /calendars/primary/events/{eventId}`
  - `DELETE /calendars/primary/events/{eventId}` (used to clean up deleted, completed, hidden, or duplicate Classroom Hub events)

## 4. Gmail API

Sends due-date reminders, new-post digests, Sunday summaries, and manual test emails.

- **Scope**: `gmail.send`
- **Endpoint**: `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
- **Payload**: Base64url-encoded RFC 822 MIME message with UTF-8 subject encoding and escaped HTML body. Enforces a client-side limit of 10 emails per day per account.

## 5. Discord Webhooks

Sends embed payloads for deadline reminders, new posts, Sunday summaries, and manual tests.

- **Endpoint**: `POST https://discord.com/api/webhooks/{id}/{token}` (also accepts `discordapp.com`, `ptb.discord.com`, `canary.discord.com` over HTTPS, with optional numeric `thread_id`)
- **Behavior**: `DiscordService` validates the URL, truncates fields to Discord's embed limits, sets a 10-second timeout, and retries once on HTTP 429 using `retry_after` (bounded to 3 seconds).

## 6. KMUTNB Exam Seating Proxy

- **Endpoint**: `GET /api/exam-room?IDcard={studentId}`
- **Routing**:
  - Dev (`vite.config.js`): Proxied to `http://www.scibase.kmutnb.ac.th/examroom/datatrain.php`
  - Production (`vercel.json`): Rewritten to `http://www.scibase.kmutnb.ac.th/examroom/datatrain.php`
- **Notes**: Uses a 15-second timeout and rejects responses containing `<div id="root">` (SPA shell fallback) as an upstream 502 error. Because the upstream university endpoint uses plain HTTP, student IDs are not encrypted on the proxy-to-university leg.

## 7. Retry and Error Handling (`httpClient.js`)

Google API calls run through `httpClient.request` with a 10-second request timeout:

- **HTTP 401**: Deduplicates concurrent refreshes via `refreshingPromise`, triggers a silent GIS token refresh, and retries once (`_retried401`). If refresh fails, marks the session expired.
- **HTTP 429 / 403 Rate Limit / 5xx / Network Timeout**: Retries up to 3 attempts with exponential backoff (`1s` base, `15s` max) and random jitter, unless cancelled by an `AbortSignal`.
- **Other HTTP 4xx**: Fails immediately without retrying.
