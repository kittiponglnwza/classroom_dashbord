# CH Classroom Hub 🎓

> **ลิงก์เข้าใช้งานแอปพลิเคชัน (Live URL):** [https://classrooms-hub.vercel.app/](https://classrooms-hub.vercel.app/)

**CH Classroom Hub** คือแดชบอร์ดสำหรับนักศึกษาที่ออกแบบมาในสไตล์มินิมอล (คล้าย Notion) เพื่อรวบรวมรายวิชา, การบ้าน, ประกาศ, และสื่อการเรียนการสอนจาก **Google Classroom** ให้อยู่ในหน้าจอเดียวแบบเรียลไทม์ ตัวแอปใช้ธีมสีเข้มระดับพรีเมียม (Premium Dark-slate aesthetic) เพื่อช่วยลดอาการปวดตาในช่วงเวลาที่ต้องอ่านหนังสือนานๆ

---

## 🚀 ฟีเจอร์หลัก (Key Features)

1. **🔒 ล็อกอินผ่าน Google อย่างปลอดภัย (Secure Google Auth)**:
   - เข้าสู่ระบบผ่านบัญชี Google ของคุณได้โดยตรง (รองรับทั้งอีเมลสถาบัน `@email.kmutnb.ac.th` และ Gmail ทั่วไป)
   - ปลอดภัย 100%: ระบบจัดการ Access Tokens ภายใน Session Storage ของเบราว์เซอร์เท่านั้น

2. **💾 จัดการข้อมูลแยกตามบัญชี (Scoped User Preferences)**:
   - สลับบัญชี Google ได้อย่างปลอดภัย ข้อมูลแคชทั้งหมดใน LocalStorage จะถูกแยกเก็บตามที่อยู่อีเมลของผู้ใช้ เพื่อป้องกันข้อมูลรั่วไหลระหว่างบัญชี

3. **👁️ ตัวกรองซ่อนรายวิชา (Course Visibility Filters)**:
   - สามารถซ่อนรายวิชาที่เรียนจบแล้วหรือรายวิชาจากเทอมที่แล้วได้ ทั้งแบบเลือกทีละวิชาหรือซ่อนทีละหลายวิชา
   - การบ้านจากวิชาที่ถูกซ่อนจะถูกลบออกจากหน้าแดชบอร์ดโดยอัตโนมัติ ช่วยลดความเกะกะบนหน้าจอ

4. **📅 แดชบอร์ดติดตามงานขั้นสูง (Advanced Coursework Dashboard)**:
   - ดูการบ้านโดยแยกหมวดหมู่เป็น "กำหนดส่งวันนี้" (Due Today) และ "เลยกำหนดส่ง" (Overdue)
   - ระบบนับถอยหลังที่แม่นยำ แสดงเวลากำหนดส่งได้ละเอียดถึงระดับนาที

5. **📝 สมุดโน้ตสไตล์ Notion (Notion-style Notepad)**:
   - ร่างโน้ตหรือติดตามความคืบหน้าของการบ้านในพื้นที่ส่วนตัว (Local workspace) ที่ผูกติดกับงานแต่ละชิ้น

6. **🔔 ระบบแจ้งเตือนผ่าน Gmail (Gmail Notification System)**:
   - **แจ้งเตือนแม่นยำตามวัน**: รับอีเมลแจ้งเตือนล่วงหน้า 3 วัน, 1 วัน, และในวันที่ครบกำหนดส่งการบ้าน
   - **สรุปงานวันอาทิตย์ (Sunday Digest)**: อีเมลสรุปงานที่ไม่มีกำหนดส่งชัดเจนเป็นรายสัปดาห์
   - **ระบบกันสแปม (Anti-Spam)**: รวมประกาศและโพสต์ใหม่ๆ ไว้ในอีเมลสรุปฉบับเดียวเพื่อไม่ให้รกกล่องจดหมาย

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

* **Frontend Framework**: React 19 (Vite 8)
* **Routing**: React Router 7 (การนำทางแบบ SPA client-side)
* **Styling**: Vanilla CSS + Tailwind CSS v4 (บังคับใช้ธีม Dark-slate)
* **Icons**: Lucide React
* **Integration APIs**: Google Identity Services (OAuth 2.0 Implicit flow) + Google Classroom API + Google Drive API

---

## 📚 เอกสารประกอบ (Documentation)

หากต้องการดูรายละเอียดเชิงลึกเกี่ยวกับสถาปัตยกรรม, การติดตั้ง, และการใช้งาน สามารถอ้างอิงจากเอกสารด้านล่างนี้:

- **[สถาปัตยกรรม (ARCHITECTURE.md)](./docs/ARCHITECTURE.md)**: การออกแบบระบบและการไหลของข้อมูล
- **[อ้างอิง API (API_REFERENCE.md)](./docs/API_REFERENCE.md)**: Endpoints ของ Google API และการจัดการข้อผิดพลาด
- **[นโยบายความปลอดภัย (SECURITY.md)](./docs/SECURITY.md)**: ขั้นตอนการทำงานของ OAuth, การจัดเก็บ Token, และการป้องกัน XSS
- **[คู่มือการตั้งค่าขึ้นเซิร์ฟเวอร์ (DEPLOYMENT_GUIDE.md)](./docs/DEPLOYMENT_GUIDE.md)**: คำแนะนำในการนำขึ้น Vercel และการตั้งค่า Google Cloud Console
- **[คู่มือผู้ใช้งาน (USER_MANUAL_TH.md)](./docs/USER_MANUAL_TH.md)**: คู่มือภาษาไทยสำหรับผู้ใช้งานทั่วไป
- **[การร่วมพัฒนา (CONTRIBUTING.md)](./docs/CONTRIBUTING.md)**: แนวทางในการร่วมพัฒนาโค้ด (Contributing guidelines)
- **[บันทึกการเปลี่ยนแปลง (CHANGELOG.md)](./CHANGELOG.md)**: ประวัติการอัปเดตเวอร์ชั่น (Version history)
- **[ADRs](./docs/ADR/)**: บันทึกการตัดสินใจเชิงสถาปัตยกรรม (Architecture Decision Records) ที่อธิบายเหตุผลของการเลือกใช้เทคโนโลยีหลัก

---

## ⚙️ เริ่มต้นใช้งาน (Quick Start สำหรับนักพัฒนา)

### 1. โคลนโปรเจกต์ & ติดตั้ง (Clone & Install)
```bash
git clone https://github.com/kittiponglnwza/classroom-dashboard.git
cd classroom-dashboard
npm install
```

### 2. ตัวแปรสภาพแวดล้อม (Environment Variables)
สร้างไฟล์ `.env` ในโฟลเดอร์หลัก (Root directory) และใส่ Google Client ID ของคุณลงไป:
```env
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

### 3. รันเซิร์ฟเวอร์ (Run Development Server)
```bash
npm run dev
```

---

## 👨‍💻 ข้อมูลนักพัฒนา (Developer Information)

* **ชื่อ**: Kittipong Teerasee (กิตติพงษ์ ธีระสี)
* **รหัสนักศึกษา**: 6704082611115
* **สถาบัน**: มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ (KMUTNB)
* **GitHub**: [kittiponglnwza](https://github.com/kittiponglnwza)

---

## 📄 ลิขสิทธิ์ (License)

โปรเจกต์นี้ใช้ลิขสิทธิ์แบบ MIT License - สามารถอ่านรายละเอียดเพิ่มเติมได้ที่ไฟล์ [LICENSE](LICENSE)
