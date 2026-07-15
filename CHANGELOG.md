# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-15
### Added (เพิ่มฟีเจอร์ใหม่)
- **ระบบหมวดหมู่ (Topics & Grouping):** จัดกลุ่มงานและสื่อการสอนตามหัวข้อ (Topics) ที่ดึงมาจาก Google Classroom ในหน้ารายละเอียดวิชา
- **List View แบบพับเก็บได้:** ดีไซน์ List View ใหม่ให้แสดงผลแบบย่อ-ขยายได้ (Accordion) คล้ายกับต้นฉบับของ Google Classroom เพื่อลดความเกะกะบนหน้าจอ

### Changed (การเปลี่ยนแปลง)
- **ปรับโฉมหน้า Dashboard:** ยกเครื่อง UI ให้เป็นแบบมินิมอล (Minimalist) ลบเส้นขอบที่หนาเกินไป, รวมแถบฟิลเตอร์ให้ดูสะอาดขึ้น, ย่อส่วนวิดเจ็ต "ตารางเรียนวันนี้" ให้เป็นแถบขนาดเล็ก และตั้งค่าให้ List View เป็นมุมมองเริ่มต้น
- **ดีไซน์ปุ่มฟิลเตอร์หมวดหมู่:** เปลี่ยนจาก Dropdown ธรรมดาให้กลายเป็นแถบปุ่มกด (Pill buttons) แนวนอนที่เลื่อนได้และมีความสวยงามแบบโปร่งแสง
- **ปรับปรุง Kanban Board:** แก้ไขปัญหาความสูงของการ์ดงานที่ยืดยาวเกินไปเวลาแสดงผลบนบอร์ด และปรับดีไซน์คอลัมน์ให้ดูเนียนตาขึ้น

### Fixed (แก้ไขบั๊ก)
- **แก้บั๊ก Settings Sync:** แก้ไขปัญหา LocalStorage พัง (Parsing error) ที่เกิดจากการจัดการคีย์อีเมลของระบบตั้งเวลาแจ้งเตือนรายสัปดาห์ (Sunday Digest)

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
