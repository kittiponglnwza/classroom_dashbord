# API Reference

CH Classroom Hub interacts heavily with Google's REST APIs. We act entirely as a client-side application consuming these services. This document outlines the endpoints, request structures, and error codes handled by our application.

## 1. Google Classroom API

The primary source of truth for coursework, courses, and announcements.

### 1.1 List Courses
- **Endpoint**: `GET https://classroom.googleapis.com/v1/courses`
- **Scopes Required**: `https://www.googleapis.com/auth/classroom.courses.readonly`
- **Parameters**: 
  - `studentId`: 'me'
  - `courseStates`: 'ACTIVE'
- **Response Handling**: The application parses the `courses` array. We extract `id`, `name`, `section`, `descriptionHeading`, `room`, `courseState`, and `alternateLink`.

### 1.2 List CourseWork
- **Endpoint**: `GET https://classroom.googleapis.com/v1/courses/{courseId}/courseWork`
- **Scopes Required**: `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
- **Response Handling**: 
  - Due dates are converted from Google's `Year-Month-Day` / `Hours-Minutes` format into standard JavaScript `Date` objects.
  - Materials and Attachments are mapped to internal application components.

### 1.3 List Announcements
- **Endpoint**: `GET https://classroom.googleapis.com/v1/courses/{courseId}/announcements`
- **Scopes Required**: `https://www.googleapis.com/auth/classroom.announcements.readonly`
- **Behavior**: Used to fetch the latest teacher posts. Text content is rendered through React JSX, which escapes text, and external links are checked with the app's URL sanitizer.

## 2. Google Drive API (App Data Folder)

Used as a pseudo-database to synchronize user preferences, schedules, and custom metadata (e.g., Exam Rooms, Hidden Courses) across devices.

### 2.1 Find Sync File
- **Endpoint**: `GET https://www.googleapis.com/drive/v3/files`
- **Scopes Required**: `https://www.googleapis.com/auth/drive.appdata`
- **Parameters**:
  - `spaces`: 'appDataFolder'
  - `q`: `name='classroom_hub_sync_settings.json'`

### 2.2 Create / Update Sync File
- **Endpoint**: `POST / PUT https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
- **Payload**: Contains stringified JSON of the user's `SettingsContext` and `ClassroomContext` state.
- **Conflict Resolution**: Collection records are merged locally using their update metadata and deletion tombstones, then the merged payload is written back to Drive.

## 3. Error Handling & Codes

Our `httpClient` intercepts API requests and maps specific Google error codes into human-readable warnings:

- **HTTP 401 (Unauthorized)**: Triggers a silent token refresh via the GIS client. If it fails, forces a hard logout.
- **HTTP 403 (Forbidden)**: Usually signifies insufficient scopes or a missing Classroom account. Handled as a non-retryable fatal error.
- **HTTP 429 (Too Many Requests)**: Triggers our internal Exponential Backoff mechanism.
- **HTTP 5xx (Internal Server Errors)**: Retryable. If persistent, displays an "API Unreachable" boundary error to the user.

## 4. KMUTNB Exam Seating

Automatic seat lookup calls `/api/exam-room?IDcard={studentId}` through a proxy to the university endpoint. The upstream currently uses HTTP, so student IDs are not encrypted on the Vercel-to-university leg. Users can also import Reg data or add exam schedules manually.
