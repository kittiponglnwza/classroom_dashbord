# ADR 0001: Using Google Drive AppData for Synchronization

**Date**: 2026-07-09
**Status**: Accepted

## Context
CH Classroom Hub needs a way to persist user preferences (e.g., hidden courses, schedule configurations, manual exam entries) across multiple devices (e.g., laptop and mobile). Because this is a frontend-only SPA (Single Page Application) built for a portfolio/student-use case, deploying and maintaining a dedicated backend server and database (like PostgreSQL or MongoDB) introduces unnecessary cost, complexity, and operational overhead.

## Decision
We will use the **Google Drive AppData API** (`https://www.googleapis.com/auth/drive.appdata`) as our primary synchronization backend.

## Rationale
- **Zero Cost & Zero Maintenance:** We do not need to host a database server. 
- **Security & Privacy:** The `appDataFolder` is a hidden, application-specific folder. The user retains complete ownership of their data, and third-party apps cannot access it.
- **Convenience:** The user is already authenticating with Google to access Classroom data. Reusing this credential for Drive access provides a frictionless experience.

## Consequences
- **Positive:** Serverless architecture, high privacy, zero backend costs.
- **Negative:** Drive API is slower than a traditional database. To mitigate this, we employ a heavy LocalStorage caching strategy (`offline-first` approach) and only sync in the background.
