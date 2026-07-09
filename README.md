# CH Classroom Hub 🎓

> **Live Application URL:** [https://classrooms-hub.vercel.app/](https://classrooms-hub.vercel.app/)

**CH Classroom Hub** is a minimalistic, Notion-style student dashboard designed to consolidate courses, assignments, announcements, and study materials from **Google Classroom** into a single, real-time interface. It features a premium Dark-slate aesthetic to reduce eye strain during long study sessions.

---

## 🚀 Key Features

1. **🔒 Secure Google Auth & Direct Connection**:
   - Login directly via your Google Account (supports institutional `@email.kmutnb.ac.th` and standard Gmail). 
   - 100% secure: Access Tokens are managed purely in browser Session Storage.

2. **💾 Scoped User Preferences**:
   - Safely switch between multiple Google Accounts. All cached data in LocalStorage is strictly scoped by the user's email address to prevent data leakage.

3. **👁️ Course Visibility Filters**:
   - Hide completed or past-semester courses individually or in bulk.
   - Assignments from hidden courses are automatically purged from your dashboard, reducing visual clutter.

4. **📅 Advanced Coursework Dashboard**:
   - View assignments categorized by "Due Today" and "Overdue".
   - Precision Countdown Heuristics display due times down to the minute.

5. **📝 Notion-style Notepad**:
   - Draft notes or track assignment progress in a private, local workspace attached to each coursework item.

6. **🔔 Gmail Notification System (Apps Script)**:
   - **Calendar-day accuracy**: Receive reminders 3 days before, 1 day before, and on the day an assignment is due.
   - **Sunday Digest**: Weekly summary for assignments with no explicit due dates.
   - **Anti-Spam**: New posts and announcements are batched into a single digest email.

---

## 🛠️ Tech Stack

* **Frontend Framework**: React 19 (Vite 8)
* **Routing**: React Router 7 (SPA client-side navigation)
* **Styling**: Vanilla CSS + Tailwind CSS v4 (Enforced Dark-slate aesthetic)
* **Icons**: Lucide React
* **Integration APIs**: Google Identity Services (OAuth 2.0 Implicit flow) + Google Classroom API + Google Drive API

---

## 📚 Documentation

For a deep dive into the architecture, setup, and usage, please refer to the documents below:

- **[Architecture (ARCHITECTURE.md)](./docs/ARCHITECTURE.md)**: System design and data flow.
- **[API Reference (API_REFERENCE.md)](./docs/API_REFERENCE.md)**: Google API endpoints and error handling.
- **[Security Policy (SECURITY.md)](./docs/SECURITY.md)**: OAuth flows, token storage, and XSS prevention.
- **[Deployment Guide (DEPLOYMENT_GUIDE.md)](./docs/DEPLOYMENT_GUIDE.md)**: Instructions for deploying to Vercel and setting up Google Cloud Console.
- **[User Manual (USER_MANUAL_TH.md)](./docs/USER_MANUAL_TH.md)**: Thai manual for end-users.
- **[Contributing (CONTRIBUTING.md)](./docs/CONTRIBUTING.md)**: Guidelines for contributing to the repository.
- **[Changelog (CHANGELOG.md)](./CHANGELOG.md)**: Version history.
- **[ADRs](./docs/ADR/)**: Architecture Decision Records detailing core technical choices.

---

## ⚙️ Quick Start (Development)

### 1. Clone & Install
```bash
git clone https://github.com/kittiponglnwza/classroom-dashboard.git
cd classroom-dashboard
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory and add your Google Client ID:
```env
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

### 3. Run Development Server
```bash
npm run dev
```

---

## 👨‍💻 Developer Information

* **Name**: Kittipong Teerasee
* **Student ID**: 6704082611115
* **Institution**: King Mongkut's University of Technology North Bangkok (KMUTNB)
* **GitHub**: [kittiponglnwza](https://github.com/kittiponglnwza)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
