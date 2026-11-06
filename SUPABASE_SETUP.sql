-- 40FPS GANG: ตรวจสอบ/เติมโครงสร้างที่หน้าเว็บต้องใช้
-- รันหลังจาก SQL ขั้นตอนก่อนหน้าสำเร็จ
alter table public.members add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists members_user_id_unique on public.members(user_id) where user_id is not null;
alter table public.deliveries add column if not exists sender_member_id uuid references public.members(id);

-- ให้ผู้ใช้ที่ล็อกอินอ่านข้อมูลกิจกรรมและสมาชิกที่ยังใช้งาน
alter table public.members enable row level security;
alter table public.activities enable row level security;
alter table public.attendance enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.weekly_payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.leave_requests enable row level security;
alter table public.audit_logs enable row level security;

-- หมายเหตุ: นโยบายเดิมที่สร้างไว้ยังคงอยู่; อย่าเปิด anon access
-- เพิ่มสิทธิ์อ่านรายการส่งของสำหรับสมาชิกที่ล็อกอิน
drop policy if exists "deliveries_authenticated_read" on public.deliveries;
create policy "deliveries_authenticated_read" on public.deliveries
for select to authenticated using (true);

-- สมาชิกยื่นลาได้เฉพาะตัวเอง; ผู้ดูแลอนุมัติผ่าน policy ที่ตั้งไว้
-- เช็คชื่อให้ทำได้เฉพาะ Leader/Co-Leader ตาม policy ขั้นตอนที่ 16
