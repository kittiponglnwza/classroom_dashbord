# ADR 0003: Client-Side Google OAuth Token Flow

**Date**: 2026-07-09
**Status**: Accepted

## Context

The app needs OAuth tokens to call Google Classroom, Google Drive AppData, Google Calendar, and Gmail APIs. Choosing between a server-side Authorization Code flow and a client-side Token flow determines whether a backend is required to hold a client secret and refresh tokens.

## Decision

Use the browser-based Google Identity Services (GIS) Token Client (`window.google.accounts.oauth2.initTokenClient`) directly in `src/services/googleClassroomClient.js`.

## Rationale

- **No backend secrets**: Works cleanly in a static SPA without exposing an OAuth client secret.
- **Shorter token lifetime**: Access tokens live for about an hour and stay in React state and `sessionStorage` (`classroom_hub_access_token`) with a 60-second expiry guard, never in `localStorage`.

## Consequences

- **Trade-off**: Tokens expire after roughly an hour because there is no long-lived refresh token.
- **Mitigation**: `httpClient` intercepts `401 Unauthorized` responses, deduplicates concurrent refresh attempts, and triggers a silent GIS token request (`prompt: 'none'` with `login_hint`) via `AuthContext.handleSilentRefresh` before retrying the failed request once.
