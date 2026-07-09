# ADR 0003: Client-Side Implicit OAuth Flow

**Date**: 2026-07-09
**Status**: Accepted

## Context
The application requires authorization to access user data from Google Classroom and Google Drive. We had to choose between a Server-side Authorization Code Flow (requiring a Node.js/Python backend to exchange codes for refresh tokens) and a Client-side Implicit Flow (where tokens are delivered directly to the browser).

## Decision
We selected the **Client-Side Implicit Flow** utilizing the `@react-oauth/google` library and Google Identity Services (GIS). 

## Rationale
- **Backend-less Architecture:** As outlined in ADR 0001, we want to avoid hosting a backend server. The Implicit flow is designed specifically for Single Page Applications (SPAs).
- **Security:** Tokens are held purely in browser memory (and temporarily in `sessionStorage` for page reloads). Because there is no persistent refresh token stored on the client, the blast radius of an XSS attack is limited to the short lifespan of the access token (1 hour).

## Consequences
- **Positive:** Zero backend infrastructure required. Extremely fast login process.
- **Negative:** The access token expires every hour.
- **Mitigation:** We implemented a silent token refresh mechanism. When the `httpClient` intercepts a `401 Unauthorized` response, it automatically attempts to re-authorize the user in the background via a hidden iframe before retrying the failed request.
