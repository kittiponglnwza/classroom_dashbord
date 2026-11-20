# CH Classroom Hub — KMUTNB Reg Auto-Sync Extension

ส่วนเสริมสำหรับ Chrome / Edge (Manifest V3) ที่ช่วยให้ **CH Classroom Hub** ซิงค์ตารางเรียน วันสอบ และผลการศึกษาจาก `reg.kmutnb.ac.th` อัตโนมัติทุกครั้งที่คุณเปิดดูหน้าเว็บ **โดยไม่ต้องเก็บรหัสผ่าน ICIT และไม่ต้องก๊อปวางเอง**

## วิธีติดตั้ง (3 ขั้นตอน)

1. เปิด Chrome พิมพ์ `chrome://extensions` (หรือ Edge พิมพ์ `edge://extensions`)
2. เปิดสวิตช์ **Developer mode** (โหมดนักพัฒนาซอฟต์แวร์) มุมขวาบน
3. กดปุ่ม **Load unpacked** (โหลดส่วนขยายที่ไม่ได้แพ็กเกจ) แล้วเลือกโฟลเดอร์ `extension/` ของโปรเจกต์นี้

## วิธีใช้งาน

1. เปิดหน้า **ตารางเรียน/สอบ** (`https://reg.kmutnb.ac.th/registrar/timetable`) และ/หรือ **ผลการศึกษา** (`https://reg.kmutnb.ac.th/registrar/grade`) ด้วยบัญชี ICIT ของคุณตามปกติ
2. Extension จะจับข้อมูลตารางให้อัตโนมัติ (ขึ้นป้ายสีเขียวเล็กๆ มุมขวาล่าง)
3. เปิดเว็บ **CH Classroom Hub** (`https://classrooms-hub.vercel.app`) → ข้อมูลตารางเรียน วันสอบ เกรด และเกณฑ์จบหลักสูตรจะซิงค์เข้าเว็บ + Google Drive + Google Calendar ให้อัตโนมัติทันที!
4. รอบหน้าเมื่อเทอมเปลี่ยนหรือเกรดออก แค่เปิดหน้า Reg มจพ. อีกรอบ ระบบก็จะอัปเดตให้อัตโนมัติเช่นเดิม

## ความปลอดภัย
- ไม่เก็บรหัสผ่านหรือ Cookie ของ ICIT
- ตัดชื่อ-สกุล เบอร์ติดต่อ และเมนูระบบทิ้งก่อนบันทึก
- ขอสิทธิ์เฉพาะ `storage` และ `activeTab` เท่านั้น และทำงานเฉพาะบน `reg.kmutnb.ac.th/registrar/*` กับ `classrooms-hub.vercel.app`
