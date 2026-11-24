# CH Classroom Hub

Live app: [https://classrooms-hub.vercel.app/](https://classrooms-hub.vercel.app/)

CH Classroom Hub is a dark-mode student dashboard built to keep Google Classroom coursework, class timetables, exam seating, GPA tracking, and deadline alerts in one place. It runs entirely in the browser using Google APIs and local storage, with no custom backend server.

## Features

- **Google Sign-In and Multi-Account Isolation**: Signs in with Google Identity Services using short-lived OAuth tokens stored in `sessionStorage` (never `localStorage`). Local caches are scoped by email so multiple Google accounts can share a browser without mixing data.
- **Coursework Dashboard**: Tracks assignments across To Do, In Progress, Completed, and Read (Material) states, highlights due-today and overdue work, supports list/grid/Kanban views, and includes per-task notes.
- **Courses and Pinning**: Groups course materials and announcements by topic, lets you pin important posts to the top, and lets you hide old or finished courses individually or in bulk.
- **Schedule and Google Calendar Sync**: Displays daily and weekly timetables, checks for time conflicts, pauses recurring class events during exam weeks, and keeps Google Calendar events synced without creating duplicates.
- **Exam Room**: Checks official KMUTNB exam seating through `/api/exam-room` (with a visible warning that the university endpoint currently uses unencrypted HTTP), and supports importing exam dates from KMUTNB Reg or adding exams manually.
- **Academic and GPA Tools**: Imports grade reports and timetables from KMUTNB Reg, plots term GPA and cumulative GPAX trends, checks graduation credit progress, includes a What-If GPA simulator and target GPAX calculator, and lets you blur grades on screen.
- **Notifications**: Sends due-date reminders, new-post digests, and Sunday weekly summaries through Gmail or a Discord Webhook, plus a copyable Google Apps Script for 24/7 Discord alerts.
- **Cross-Device Sync and Companion Extension**: Syncs settings, hidden courses, notes, schedules, and custom tasks through your private Google Drive `appDataFolder`, and pairs with a Chrome/Edge extension in `extension/` for automatic Reg imports without storing passwords.

## Tech Stack

- **Frontend**: React 19, Vite 8, React Router 7
- **Styling and Icons**: Tailwind CSS v4, Lucide React
- **Testing and Tooling**: Vitest, Testing Library, TypeScript (`tsc --noEmit`), ESLint, Husky, Commitlint
- **APIs**: Google Identity Services, Google Classroom, Google Drive AppData, Google Calendar, Gmail, Discord Webhooks

## Documentation

- [User Manual](./docs/USER_MANUAL.md) - How to use each page and feature
- [Architecture](./docs/ARCHITECTURE.md) - How contexts, caching, and sync work
- [API Reference](./docs/API_REFERENCE.md) - External endpoints, retries, and error handling
- [Security](./docs/SECURITY.md) - Auth flow, storage isolation, XSS defenses, and known risks
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) - Google Cloud setup and Vercel deployment
- [Contributing](./docs/CONTRIBUTING.md) - Local workflow, commits, and checks
- [ADRs](./docs/ADR/) - Short architecture decision notes
- [Extension Guide](./extension/README.md) - Installing and using the Chrome/Edge Reg sync extension
- [Changelog](./CHANGELOG.md) - Release notes

## Quick Start

Requires Node.js 20.19+ or 22.12+.

```bash
git clone https://github.com/kittiponglnwza/classroom_dashbord.git
cd classroom_dashbord
npm install
```

Create a `.env` file in the project root with your Google OAuth Client ID:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

Start the dev server:

```bash
npm run dev
```

Useful scripts:

```bash
npm run typecheck   # Check TypeScript files
npm run lint        # Run ESLint
npm run test        # Run unit tests
npm run coverage    # Run tests with coverage thresholds
npm run build       # Build production bundle and PWA assets
```

## Developer

- **Name**: Kittipong Teerasee
- **Student ID**: 6704082611115
- **University**: King Mongkut's University of Technology North Bangkok (KMUTNB)
- **GitHub**: [kittiponglnwza](https://github.com/kittiponglnwza)

## License

Licensed under the MIT License. See [LICENSE](LICENSE).
