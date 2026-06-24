# CH Classroom Hub 🎓

> **Live Application URL:** [https://classrooms-hub.vercel.app/](https://classrooms-hub.vercel.app/)

**CH Classroom Hub** คือเว็บแอปพลิเคชันรูปแบบ Student Dashboard สไตล์ Notion ที่มีความมินิมอลและถนอมสายตา (Premium Dark-slate Theme) ออกแบบมาเพื่อรวบรวมข้อมูลรายวิชา งานที่ได้รับมอบหมาย (Coursework) ประกาศ (Announcements) และเอกสารประกอบการเรียน (Materials) จาก **Google Classroom** ของผู้ใช้มารวมไว้ในที่เดียวแบบเรียลไทม์

---

## 🚀 ฟีเจอร์หลัก (Key Features)

1. **🔒 Secure Google Auth & Direct Connection**:
   - ล็อกอินด้วยบัญชี Google (รองรับทั้งอีเมลสถาบันการศึกษาอย่าง `@email.kmutnb.ac.th` และอีเมลทั่วไป) ปลอดภัย 100% ด้วยการจัดการ Access Token ผ่าน Session Storage (หมดกังวลเรื่องการรั่วไหลผ่าน XSS)

2. **💾 Scoped User Preferences (ระบบแยกบัญชี)**:
   - จัดเก็บข้อมูลแยกตาม Google Account ใน LocalStorage โดยใช้ Email เป็นตัวกำหนดขอบเขตข้อมูล (Email-scoped Cache Keys) ป้องกันการปะปนข้อมูลเมื่อสลับบัญชีใช้งาน

3. **👁️ Course Visibility Filters (จัดการซ่อนวิชาเรียนค้างปี)**:
   - สามารถเลือกซ่อนวิชาที่เรียนจบแล้วหรือจบเทอมไปแล้วได้ทั้งแบบรายวิชา หรือแบบซ่อนหลายวิชาพร้อมกัน (Bulk Visibility Configuration) 
   - งานค้างจากวิชาที่ถูกซ่อนจะถูกคัดกรองออกจากบอร์ดการบ้าน โดม และแดชบอร์ดโดยอัตโนมัติเพื่อลดความแอดอัดของสายตา

4. **📅 Advanced Coursework Dashboard**:
   - หน้าแดชบอร์ดหลักที่แบ่งออกเป็น "งานที่ต้องส่งวันนี้ (Due Today)" และ "งานที่เลยกำหนดส่ง (Overdue)"
   - ระบบนับเวลาถอยหลัง (Countdown Heuristics) ที่ละเอียดเป็นนาที/ชั่วโมง หากส่งภายในวันนั้น

5. **📝 Notion-style Notepad**:
   - ระบบบันทึกข้อความหรือบันทึกความคืบหน้าของงานแต่ละชิ้นแบบส่วนตัว (Draft Workspace Notes) บันทึกลง LocalStorage ของผู้ใช้คนนั้นโดยอัตโนมัติ

6. **🔔 Gmail Notification System (ระบบแจ้งเตือนทาง Gmail)**:
   - **ความแม่นยำสูง (Calendar-day accuracy)**: ตรวจสอบความต่างของวันปฏิทินเพื่อส่งอีเมลเตือนก่อนครบกำหนด 3 วัน, ก่อนครบกำหนด 1 วัน, วันครบกำหนดส่ง และส่งเตือนงานเลยกำหนดส่ง 1 วัน (ส่งเพียงครั้งเดียว)
   - **Sunday Digest (งานสะสมไม่มีกำหนดส่ง)**: สำหรับอาจารย์ที่ไม่ระบุ Due Date ระบบจะรวบรวมส่งเป็นเมลสรุปทุกวันอาทิตย์ตามเวลาที่ผู้ใช้ตั้งไว้ พร้อมระบบส่งย้อนหลังอัตโนมัติ (Catch-up) เมื่อเปิดแอปหากผู้ใช้ปิดเครื่องในวันอาทิตย์
   - **Anti-Spam New Post Digest**: รวบรวมงานและประกาศใหม่ที่ตรวจพบระหว่างการกดซิงก์ข้อมูล ส่งเมลสรุปรวมเป็นฉบับเดียวทันที เพื่อป้องกันการส่งอีเมลถี่เกินไป (Spam)
   - **Safety Limits**: จำกัดการส่งอีเมลไม่เกิน 3 ฉบับต่อวัน ป้องกันการสแปม Google API และตรวจสอบสิทธิ์ผ่านระบบ Deduplication Registry
   - **Notification History Log**: มีระบบบันทึกประวัติการส่งแจ้งเตือนในหน้าตั้งค่าเพื่อให้ผู้ใช้ย้อนดูประวัติการเตือนได้

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

* **Frontend Framework**: React 19 (Vite 8)
* **Routing**: React Router 7 (SPA client-side navigation)
* **Styling**: Vanilla CSS + Tailwind CSS v4 (Enforced Dark-slate premium aesthetic)
* **Icons**: Lucide React
* **Integration APIs**: Google GIS SDK (OAuth 2.0 Client-side implicit flow) + Google Classroom API + Gmail REST API

---

## ⚙️ ขั้นตอนการติดตั้งและการนำไปพัฒนาต่อ (Development Guide)

### 1. โคลนและติดตั้ง Package
```bash
# โคลนคลังเก็บโค้ด
git clone <repository-url>
cd Classrooms

# ติดตั้ง dependencies
npm install
```

### 2. ตั้งค่าไฟล์สภาพแวดล้อม (Environment Variables)
สร้างไฟล์ `.env` ในโฟลเดอร์ Root ของโปรเจกต์ และเพิ่ม Google Client ID ของคุณ:
```env
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

### 3. รันโปรเจกต์ในเครื่อง (Local Dev)
```bash
npm run dev
```
แอปพลิเคชันจะรันบน [http://localhost:5173/](http://localhost:5173/) หรือ [http://localhost:5174/](http://localhost:5174/)

### 4. คอมไพล์สำหรับการนำขึ้นเซิร์ฟเวอร์จริง (Production Build)
```bash
npm run build
```
ไฟล์พร้อม Deploy จะถูกสร้างไว้ในโฟลเดอร์ `dist/`

---

## 👨‍💻 ข้อมูลนักพัฒนา (Developer Information)

* **ชื่อ-นามสกุล**: กิตติพงศ์ ธีระศรี (Kittipong Teerasee)
* **ชื่อเล่น**: Kittiponglnwza
* **รหัสนักศึกษา**: 6704082611115
* **สถาบัน**: มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ (KMUTNB)
* **GitHub**: [https://github.com/kittiponglnwza](https://github.com/kittiponglnwza)
