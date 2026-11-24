# CH Classroom Hub - KMUTNB Reg Auto-Sync Extension

Chrome and Edge (Manifest V3) companion extension that captures your timetable, exam dates, and grade reports from `reg.kmutnb.ac.th` and syncs them into CH Classroom Hub automatically whenever you visit Reg. It never asks for or stores your ICIT password or cookies.

## Install

1. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `extension/` folder from this repository.

## Usage

1. Sign in to `reg.kmutnb.ac.th` as usual and open your **Timetable** (`https://reg.kmutnb.ac.th/registrar/timetable`) and/or **Grade Report** (`https://reg.kmutnb.ac.th/registrar/grade`).
2. The extension captures the table data locally and shows a small green confirmation toast in the bottom-right corner.
3. Open CH Classroom Hub (`https://classrooms-hub.vercel.app/` or local dev). Your timetable, exam dates, grades, and graduation progress sync automatically and trigger Drive and Calendar updates.

Whenever grades or schedules change in a new term, visit the Reg pages again and the extension will push the updated snapshot on your next visit to the web app.

## Privacy and Permissions

- **Permissions**: Requests `storage`, `activeTab`, and `scripting`, with host access scoped strictly to `https://*.kmutnb.ac.th/registrar/*`.
- **No credentials stored**: Does not touch passwords or ICIT session cookies.
- **Data minimization**: Strips names, contact details, and page navigation chrome before storing snapshots.
- **Origin and account checks**: `bridge.js` only communicates via `window.postMessage` with `https://classrooms-hub.vercel.app` and local Vite dev/preview origins, and the web app checks a one-way FNV-1a Student ID hash so snapshots from one student account cannot overwrite another.
