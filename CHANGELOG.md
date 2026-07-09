# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-07-09
### Added
- **Course Visibility Filters:** Ability to hide past or completed courses individually or in bulk.
- **Unlisted/Outdated Data Alert:** Warning banners indicating when exam room data or schedules are outdated or missing.

### Fixed
- Overlapping schedule syncing logic that reverted user edits to previous states.
- AuthContext mapping issue preventing the logout button from functioning correctly in Settings.
- ESLint configuration and unused variable cleanups ensuring a 100% clean codebase.

## [1.1.0] - 2026-06-15
### Added
- **Gmail Notification System:** Automated calendar-day accurate notifications for due dates (3 days prior, 1 day prior, day-of, 1 day overdue).
- **Anti-Spam Digest:** Batched email notifications for new posts to avoid spamming user inboxes.
- **Sunday Digest:** Weekly summary for assignments without explicit due dates.

### Changed
- Switched default layout to Premium Dark-slate Theme.
- Enhanced Countdown Heuristics to display minute/hour granularity for assignments due today.

## [1.0.0] - 2026-05-01
### Added
- Initial release of CH Classroom Hub.
- **Secure Google Auth:** Client-side implicit flow with token management in Session Storage.
- **Scoped User Preferences:** Email-scoped LocalStorage to support multiple accounts safely.
- **Advanced Coursework Dashboard:** Segregated views for Due Today and Overdue assignments.
- **Notion-style Notepad:** Local private workspace for drafting notes on assignments.
