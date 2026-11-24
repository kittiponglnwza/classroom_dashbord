# ADR 0001: Google Drive AppData for Cross-Device Sync

**Date**: 2026-07-09
**Status**: Accepted

## Context

CH Classroom Hub needs to sync user preferences, hidden courses, task completion states, personal notes, timetables, academic records, and manual exams across devices. Running a dedicated backend database would add hosting cost, server maintenance, and another layer of user data management.

## Decision

Use the Google Drive AppData API (`https://www.googleapis.com/auth/drive.appdata`) as the remote sync store (`classroom_hub_sync_settings.json`).

## Rationale

- **No backend required**: Keeps the app a pure static SPA hosted on Vercel.
- **Private per-user storage**: Files in `appDataFolder` belong to the user's own Google Drive and are hidden from normal Drive browsing and other applications.
- **Single sign-in flow**: Users already sign in with Google for Classroom, so Drive sync does not require a second account.

## Consequences

- **Trade-off**: Google Drive requests are noticeably slower than a dedicated database API.
- **Mitigation**: All reads come from `localStorage` first (`StorageRepository` with an in-memory cache). Syncing runs in the background, checks `file.modifiedTime` before downloading `alt=media`, and merges collections item-by-item using field timestamps and deletion tombstones so devices converge cleanly without overwriting edits.
