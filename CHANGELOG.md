# Changelog

Notable updates to CH Classroom Hub are recorded here.

## [1.3.0] - 2026-07-15

### Added
- **Topic grouping**: Groups assignments and course materials by Google Classroom topic in course details.
- **Collapsible list view**: Accordion-style list view on the dashboard to keep dense task lists readable.

### Changed
- **Minimalist dashboard refresh**: Simplified card borders, condensed filter pills into a scrollable horizontal bar, compacted Today's Classes, and set List View as default.
- **Kanban card sizing**: Constrained card height in Kanban columns for cleaner scrolling.

### Fixed
- **Settings sync parsing**: Fixed a `localStorage` parsing issue in Sunday Digest delivery time synchronization.

## [1.2.0] - 2026-07-09

### Added
- **Course visibility filters**: Hide finished or past-term courses individually or in bulk.
- **Exam status alerts**: Banners indicating missing or previous-semester exam listings.

### Fixed
- Schedule sync conflicts that could overwrite local timetable edits.
- Logout state cleanup in `AuthContext` when disconnecting from Settings.
- ESLint cleanup across the codebase.

## [1.1.0] - 2026-06-15

### Added
- **Gmail notifications**: Calendar-day reminders (3 days before, 1 day before, due today, 1 day overdue), consolidated new-post digests, and Sunday weekly summaries.
- **Dark-slate theme** and finer due-today countdowns down to hours and minutes.

## [1.0.0] - 2026-05-01

### Added
- Initial release of CH Classroom Hub.
- Google Identity Services client-side login with session-only token storage and email-scoped `localStorage`.
- Coursework dashboard with Due Today / Overdue tracking and private per-assignment notes.
