# 40FPS GANG MANAGEMENT — คู่มือติดตั้งภาษาไทย

## สิ่งที่มีในชุดนี้
- หน้าเข้าสู่ระบบด้วย Supabase Auth
- Dashboard รายรับ/รายจ่าย/คงเหลือ/ยอดส่งเงินรายสัปดาห์
- จัดการรายชื่อ (เพิ่ม/แก้ไข; Leader เปลี่ยนสถานะถอนสมาชิกได้)
- บันทึกส่งเงิน, ส่งของ, เช็คชื่อโดย Leader/Co-Leader, ยื่นลาและอนุมัติลา
- รองรับมือถือและคอมพิวเตอร์

## สำคัญก่อนเปิดใช้งานจริง
ชุดนี้เป็น source code สำหรับนำไปติดตั้งและทดสอบ ไม่ใช่เว็บไซต์ออนไลน์ที่เผยแพร่แล้ว
ต้องตั้งค่า RLS ให้ครบและทดสอบบัญชีแต่ละบทบาทก่อนเชิญสมาชิกใช้งานจริง
การเพิ่มชื่อสมาชิกในหน้าเว็บยังไม่สร้างบัญชี Auth ให้อัตโนมัติ ต้องให้ผู้ดูแลสร้างบัญชีใน Supabase Auth แล้วผูก user_id
ห้ามนำ service_role/secret key มาใส่ในเว็บเด็ดขาด

## ติดตั้ง
1. แตกไฟล์ ZIP
2. ติดตั้ง Node.js รุ่น LTS
3. เปิดโฟลเดอร์นี้ใน VS Code
4. คัดลอก `.env.example` เป็น `.env`
5. ใส่ Project URL และ Publishable key (หรือ anon public key) จาก Supabase → Project Settings → API
6. เปิด Terminal ในโฟลเดอร์ แล้วรัน:
   - `npm install`
   - `npm run dev`
7. เปิด URL ที่ Vite แสดงใน Terminal

## เผยแพร่เว็บ
อัปโหลดโฟลเดอร์ขึ้น GitHub แล้วนำ repository ไป Import ใน Vercel
เพิ่ม Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
จากนั้น Deploy

## หมายเหตุฐานข้อมูล
รัน `SUPABASE_SETUP.sql` ใน Supabase SQL Editor หลังตรวจสอบ schema ปัจจุบัน
SQL นี้เป็นส่วนเสริมเบื้องต้น ไม่ได้แทนการตรวจสอบ policies ทั้งหมด
