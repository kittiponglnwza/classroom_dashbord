# Deployment Guide

This guide covers Google Cloud OAuth setup and deploying CH Classroom Hub to Vercel.

## 1. Google Cloud Console Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Go to **APIs & Services > Library** and enable:
   - Google Classroom API
   - Google Drive API
   - Gmail API (needed for in-app email reminders)
   - Google Calendar API (needed for calendar sync)
3. Go to **APIs & Services > OAuth consent screen**:
   - Choose **External** (or Internal if deploying only for a single Workspace domain).
   - Fill in the app name, support email, and developer contact email.
   - Add the scopes requested by `src/config/google.js`:
     - `https://www.googleapis.com/auth/classroom.courses.readonly`
     - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
     - `https://www.googleapis.com/auth/classroom.announcements.readonly`
     - `https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly`
     - `https://www.googleapis.com/auth/classroom.topics.readonly`
     - `https://www.googleapis.com/auth/drive.appdata`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/calendar.events`
     - `openid`, `email`, and `profile`
   - While the consent screen is in **Testing** mode, add every tester's email under **Test users**; otherwise sign-in will be blocked for other users.
4. Go to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID** and select **Web application**.
   - Add **Authorized JavaScript origins**: `http://localhost:5173` for local development and your production URL (for example `https://classrooms-hub.vercel.app`).
   - Add matching **Authorized redirect URIs** if prompted, then save and copy the **Client ID**.

## 2. Environment Variables

Only the public Google OAuth Client ID is needed at build time:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Do not put private credentials or personal Discord Webhook URLs into `VITE_*` environment variables, as `VITE_*` values are embedded into the public client bundle.

## 3. Deploying to Vercel

### Vercel CLI

```bash
npm i -g vercel
vercel
```

Add `VITE_GOOGLE_CLIENT_ID` in **Project Settings > Environment Variables** on Vercel, then deploy to production:

```bash
vercel --prod
```

### GitHub Integration

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add `VITE_GOOGLE_CLIENT_ID` in Environment Variables.
4. Vercel runs `npm run build` and serves `dist/` using the headers and rewrites in `vercel.json`.

## 4. Exam Seating Proxy Configuration

- Development (`vite.config.js`) proxies `/api/exam-room` to `http://www.scibase.kmutnb.ac.th/examroom/datatrain.php`.
- Production runs the Vercel Serverless Function `api/exam-room.js` (while `vercel.json` excludes `/api/` from the SPA catch-all rewrite). Keep `UPSTREAM_EXAM_URL` in `api/exam-room.js` and the target in `vite.config.js` aligned if the university moves endpoints (and switch to HTTPS once supported).
- Make sure `VITE_GOOGLE_CLIENT_ID` is available to Serverless Runtime in Vercel **Project Settings > Environment Variables** (or set `GOOGLE_CLIENT_ID`) so `/api/exam-room` binds token checks strictly to your OAuth Client ID.
- Optional distributed rate limiting: add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel Environment Variables to enforce rate limits across all serverless instances (without them, `api/exam-room.js` uses an in-memory per-instance fallback).

## 5. Optional 24/7 Google Apps Script

In-app Gmail and Discord notifications only run while the web app is open and syncing. If users want hourly alerts while the browser is closed, they can copy the generated Google Apps Script from **Settings**, paste it into [script.google.com](https://script.google.com), enable the **Google Classroom API** service, and add an hourly trigger for `sendClassroomDigest`.
