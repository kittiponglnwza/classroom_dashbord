# Deployment Guide

This guide provides instructions for deploying CH Classroom Hub to production and setting up the required Google Cloud Console integrations.

## 1. Google Cloud Console Setup

The application requires a Google OAuth 2.0 Client ID to authenticate users and fetch Classroom data.

### Step-by-Step
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "Classroom Hub").
3. Go to **APIs & Services > Library** and enable the following APIs:
   - Google Classroom API
   - Google Drive API
4. Go to **APIs & Services > OAuth consent screen**.
   - Choose **External** (unless restricting to an organizational workspace).
   - Fill out the App Name, User support email, and Developer contact information.
   - Add the necessary scopes:
     - `.../auth/classroom.courses.readonly`
     - `.../auth/classroom.coursework.me.readonly`
     - `.../auth/classroom.announcements.readonly`
     - `.../auth/drive.appdata`
   - Add yourself as a Test User if the app is still in testing mode.
5. Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Add Authorized JavaScript origins: `http://localhost:5173` (for local dev) and your production URL (e.g., `https://classrooms-hub.vercel.app`).
   - Add Authorized redirect URIs (same as origins).
   - Click Create and copy the generated **Client ID**.

## 2. Environment Variables

Create a `.env` file in the root of your project or configure the environment variables on your hosting provider.

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

## 3. Deploying to Vercel (Recommended)

Vercel is the recommended hosting platform for Vite/React applications.

### Using Vercel CLI
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.
3. Follow the prompts to link the project.
4. Add the `VITE_GOOGLE_CLIENT_ID` in the Vercel dashboard under Settings > Environment Variables.
5. Deploy to production using `vercel --prod`.

### Using GitHub Integration
1. Push your code to a GitHub repository.
2. Go to Vercel and Import Project from GitHub.
3. Add the `VITE_GOOGLE_CLIENT_ID` environment variable during the setup phase.
4. Vercel will automatically build (`npm run build`) and deploy the application.

## 4. Google Apps Script Integration (Optional)

If you plan to utilize the Email Notification system, you must deploy the Apps Script code attached to a user's Google Account and trigger it via a generated webhook. (Refer to the `Settings` page in the UI for the Apps Script payload generation).
