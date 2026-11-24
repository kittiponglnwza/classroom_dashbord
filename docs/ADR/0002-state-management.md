# ADR 0002: React Context for Global State

**Date**: 2026-07-09
**Status**: Accepted

## Context

As the app added schedules, exam seating, GPA tracking, notifications, and multi-account switching, sharing state across pages needed a clean pattern without introducing unnecessary boilerplate.

## Decision

Use React Context split by concern (`AuthContext`, `SettingsContext`, `ClassroomContext`, `ClassroomUIContext`, and `ToastContext`) with custom hooks (`useAuth`, `useSettings`, `useClassroom`, `useClassroomUI`, `useToast`).

## Rationale

- **Minimal overhead**: Built into React with zero extra runtime dependencies or store boilerplate.
- **Clear boundaries**: Authentication, classroom syncing, UI visibility filtering, and toast feedback stay separated and easier to test in isolation.

## Consequences

- **Trade-off**: Unmemoized context values can cause broad re-renders across consumers.
- **Mitigation**: Context providers memoize exported values and callbacks with `useMemo` and `useCallback`, and derived visibility filtering (`visibleCourses`, `visibleAssignments`, `visibleResources`) lives separately in `ClassroomUIContext`.
