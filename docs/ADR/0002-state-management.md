# ADR 0002: Context over Redux for State Management

**Date**: 2026-07-09
**Status**: Accepted

## Context
As the application grew to support schedules, exam rooms, coursework, and settings, managing global state became complex. We needed a robust state management solution to prevent excessive prop-drilling. Options considered were Redux, Zustand, and React Context.

## Decision
We chose **React Context API** coupled with custom hooks (`useAuth`, `useClassroom`, `useSettings`).

## Rationale
- **Simplicity:** Redux introduces significant boilerplate (actions, reducers, store configuration) which is overkill for an application that primarily caches API responses rather than computing complex client-side interactions.
- **Native Support:** Context is built into React, meaning zero additional bundle size or dependencies.
- **Component Colocation:** By wrapping specific logic inside dedicated Context Providers (e.g., `ClassroomContext`), we can effectively encapsulate Google API fetching logic and isolate re-renders.

## Consequences
- **Positive:** Rapid development speed, lower learning curve for contributors, smaller bundle size.
- **Negative:** Context can trigger unnecessary re-renders if the value object is not properly memoized. We mitigated this by heavily enforcing `useMemo` and `useCallback` on all Context exports.
