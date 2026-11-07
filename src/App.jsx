import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard, Wallet, HandCoins, Package, Users, CalendarCheck,
  CalendarDays, LogOut, Plus, RefreshCw, Search, Menu, X, ShieldCheck,
  ArrowDownLeft, ArrowUpRight, CheckCircle2, Trash2, Edit3, Lock,
  ClipboardList, ChevronRight, Trophy
} from "lucide-react";
import "./style.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const WEEKLY_TARGET = 50000;

const NAV = [
  ["overview", "ภาพรวม", LayoutDashboard],
  ["members", "สมาชิก", Users],
  ["finance", "บัญชีรายรับ–รายจ่าย", Wallet],
  ["payments", "ส่งเงินรายสัปดาห์", HandCoins],
  ["deliveries", "ส่งของแก๊ง", Package],
  ["attendance", "เช็คชื่อกิจกรรม", CalendarCheck],
  ["leave", "แจ้งลา", CalendarDays],
  ["kindofloop", "Kind of Loop", Trophy],
];

const DELIVERY_ITEMS = [
  "Blue Monoey", "Copper", "EXP", "Gold", "Iron", "Scrap",
  "เงินแดง", "ผงเหลือง"
];

const UNIT_BY_ITEM = {
  "Blue Monoey": "ชิ้น", Copper: "กล่อง", EXP: "หน่วย", Gold: "กล่อง",
  Iron: "กล่อง", Scrap: "กล่อง", "เงินแดง": "ชิ้น", "ผงเหลือง": "ชิ้น"
};

const money = value => new Intl.NumberFormat("th-TH", {
  style: "currency", currency: "THB", maximumFractionDigits: 0
}).format(Number(value || 0));

const dateTH = value => value
  ? new Date(value).toLocaleDateString("th-TH", {
      year: "numeric", month: "short", day: "numeric"
    })
  : "-";

const dateTimeTH = value => value
  ? new Date(value).toLocaleString("th-TH")
  : "";

function getWeekStart() {
  const date = new Date();

  // เริ่มรอบทุกวันเสาร์
  const daysSinceSaturday = (date.getDay() + 1) % 7;
  date.setDate(date.getDate() - daysSinceSaturday);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function roleName(role) {
  return role === "leader" ? "Leader"
    : role === "co_leader" ? "Co-Leader" : "Member";
}

function leaveStatus(status) {
  return status === "approved" ? "อนุมัติแล้ว"
    : status === "rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ";
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [members, setMembers] = useState([]);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [activities, setActivities] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [publicLeaves, setPublicLeaves] = useState([]);
  const [kindOfLoopEntries, setKindOfLoopEntries] = useState([]);
  const [kindOfLoopSelected, setKindOfLoopSelected] = useState([]);
  const [kindOfLoopUrl, setKindOfLoopUrl] = useState("");
  const [kindOfLoopNote, setKindOfLoopNote] = useState("");
  const [modal, setModal] = useState("");
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const role = profile?.role || "public";
  const isAdmin = ["leader", "co_leader"].includes(role);
  const isLeader = role === "leader";
  const activeMembers = useMemo(
    () => members.filter(member => member.status === "active"),
    [members]
  );

  const totalIncome = income.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const currentWeek = getWeekStart();

  const paidByMember = useMemo(() => {
    const totals = {};
    payments.filter(row => row.week_start === currentWeek).forEach(row => {
      totals[row.member_id] = (totals[row.member_id] || 0) + Number(row.amount || 0);
    });
    return totals;
  }, [payments, currentWeek]);

  const weeklyPaidTotal = Object.values(paidByMember).reduce((sum, amount) => sum + amount, 0);
  const kindOfLoopLeaderboard = useMemo(() => {
  const totals = {};

  kindOfLoopEntries.forEach(entry => {
    (entry.selected_members || []).forEach(name => {
      totals[name] = (totals[name] || 0) + Number(entry.points || 1);
    });
  });

  return Object.entries(totals)
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}, [kindOfLoopEntries]);
  const pageTitle = NAV.find(item => item[0] === tab)?.[1] || "ภาพรวม";

  const loadAll = useCallback(async (showLoader = true) => {
    if (!supabase) return;
    if (showLoader) setBusy(true);
    setError("");

    try {
      let currentProfile = null;

      if (session?.user?.id) {
        const { data, error: profileError } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!data) {
          await supabase.auth.signOut();
          throw new Error("บัญชีนี้ยังไม่ได้ผูกกับรายชื่อสมาชิก กรุณาติดต่อ Leader");
        }
        currentProfile = data;
      }
      setProfile(currentProfile);

const readTables = [
  ["members", setMembers],
  ["income", setIncome],
  ["expenses", setExpenses],
  ["weekly_payments", setPayments],
  ["deliveries", setDeliveries],
  ["activities", setActivities],
  ["attendance", setAttendance],
  ["kind_of_loop_entries", setKindOfLoopEntries]
];

      const results = await Promise.all(
        readTables.map(async ([table, setter]) => {
          const { data, error: readError } = await supabase
            .from(table).select("*").limit(1000);
          if (readError) {
            console.error(`อ่าน ${table} ไม่สำเร็จ`, readError.message);
            return;
          }
          setter(data || []);
        })
      );

      const { data: publicHistory, error: publicError } = await supabase
        .from("public_leave_history")
        .select("*")
        .order("leave_date", { ascending: false })
        .limit(500);

      if (publicError) {
        console.warn("อ่านประวัติการลาไม่สำเร็จ", publicError.message);
      } else {
        setPublicLeaves(publicHistory || []);
      }

      if (["leader", "co_leader"].includes(currentProfile?.role)) {
        const { data, error: leaveError } = await supabase
          .from("leave_requests")
          .select("*")
          .order("leave_date", { ascending: false })
          .limit(500);
        if (leaveError) console.warn("อ่านคำขอลาไม่สำเร็จ", leaveError.message);
        else setLeaves(data || []);
      } else {
        setLeaves([]);
      }
    } catch (e) {
      setError(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (showLoader) setBusy(false);
    }
  }, [session]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!alive) return;
      if (authError) setError(authError.message);
      setSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (supabase) loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("40fps-management-live");
    ["members", "income", "expenses", "weekly_payments", "deliveries", "activities", "attendance","kind_of_loop_entries"]
      .forEach(table => {
        channel.on("postgres_changes", {
          event: "*", schema: "public", table
        }, () => loadAll(false));
      });
    channel.subscribe();

    const timer = window.setInterval(async () => {
      const { data, error: historyError } = await supabase
        .from("public_leave_history").select("*")
        .order("leave_date", { ascending: false }).limit(500);
      if (!historyError) setPublicLeaves(data || []);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [loadAll]);

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) throw loginError;

      setLoginOpen(false);
      setPassword("");
      setNotice("เข้าสู่ระบบสำเร็จ");
    } catch (e) {
      setError(e.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setTab("overview");
    setNotice("ออกจากระบบแล้ว");
  }

  async function refresh() {
    await loadAll();
    setNotice("อัปเดตข้อมูลแล้ว");
  }

  async function saveRow(table, values, id = null) {
    if (!isAdmin) {
      setError("เฉพาะ Leader และ Co-Leader เท่านั้นที่จัดการข้อมูลได้");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const request = id
        ? supabase.from(table).update(values).eq("id", id)
        : supabase.from(table).insert(values);
      const { error: saveError } = await request;
      if (saveError) throw saveError;
      setModal("");
      setEditingId(null);
      setForm({});
      setNotice("บันทึกข้อมูลเรียบร้อยแล้ว");
      await loadAll(false);
      return true;
    } catch (e) {
      setError(e.message || "บันทึกข้อมูลไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(table, id) {
    if (!isAdmin) return setError("ไม่มีสิทธิ์ลบข้อมูล");
    if (!window.confirm("ยืนยันลบรายการนี้หรือไม่?")) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      setNotice("ลบรายการแล้ว");
      await loadAll(false);
    }
    setBusy(false);
  }

  function openModal(type, row = null) {
    if (type === "member" && !isLeader) {
      setError("เฉพาะ Leader เท่านั้นที่จัดการรายชื่อและตำแหน่งสมาชิกได้");
      return;
    }
    if (type !== "leave" && !isAdmin) {
      setError("เฉพาะ Leader และ Co-Leader เท่านั้น");
      return;
    }
    setEditingId(row?.id || null);
    setForm(row ? { ...row } : {});
    setModal(type);
    setError("");
  }

  async function submitLeave() {
    if (!form.member_id || !form.leave_date || !form.reason?.trim()) {
      setError("กรุณากรอกชื่อสมาชิก วันที่ลา และเหตุผล");
      return;
    }
    setBusy(true);
    setError("");
    const { error: submitError } = await supabase.from("leave_requests").insert({
      member_id: form.member_id,
      leave_date: form.leave_date,
      reason: form.reason.trim(),
      status: "pending"
    });
    if (submitError) setError(`ส่งคำขอลาไม่สำเร็จ: ${submitError.message}`);
    else {
      setModal("");
      setForm({});
      setNotice("ส่งคำขอลาแล้ว กรุณารอผู้ดูแลตรวจสอบ");
      await loadAll(false);
    }
    setBusy(false);
  }

  async function toggleAttendance(activityId, memberId, existingRecord, checked) {
    if (!isAdmin || busy) return;
    setBusy(true);
    setError("");
    try {
      if (checked) {
        const { error: insertError } = await supabase.from("attendance").insert({
          activity_id: activityId,
          member_id: memberId
        });
        if (insertError) throw insertError;
      } else {
        if (!existingRecord?.id) throw new Error("ไม่พบรายการเช็คชื่อที่ต้องการยกเลิก");
        const { error: deleteError } = await supabase
          .from("attendance").delete().eq("id", existingRecord.id);
        if (deleteError) throw deleteError;
      }
      const memberName = members.find(member => member.id === memberId)?.display_name || "สมาชิก";
      setNotice(checked ? `เช็คชื่อ ${memberName} แล้ว` : `ยกเลิกเช็คชื่อ ${memberName} แล้ว`);
      await loadAll(false);
    } catch (e) {
      setError(e.message || "บันทึกเช็คชื่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function submitKindOfLoop(event) {
    event.preventDefault();

    if (!session?.user?.id) {
      setError("กรุณาเข้าสู่ระบบก่อนส่งหลักฐาน");
      return;
    }

    if (kindOfLoopSelected.length === 0) {
      setError("กรุณาเลือกสมาชิกอย่างน้อย 1 คน");
      return;
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(kindOfLoopUrl.trim());
    } catch {
      setError("กรุณาวางลิงก์หลักฐานให้ถูกต้อง");
      return;
    }

    if (parsedUrl.protocol !== "https:") {
      setError("ลิงก์หลักฐานต้องขึ้นต้นด้วย https://");
      return;
    }

    const selectedCount = kindOfLoopSelected.length;

    setBusy(true);
    setError("");

    try {
      const { error: submitError } = await supabase
        .from("kind_of_loop_entries")
        .insert({
          selected_members: kindOfLoopSelected,
          points: 1,
          image_url: parsedUrl.href,
          note: kindOfLoopNote.trim() || null,
          created_by: session.user.id
        });

      if (submitError) throw submitError;

      setKindOfLoopSelected([]);
      setKindOfLoopUrl("");
      setKindOfLoopNote("");
      setNotice(`บันทึกคะแนน +1 ให้สมาชิก ${selectedCount} คนแล้ว`);

      await loadAll(false);
    } catch (e) {
      setError(e.message || "ส่งหลักฐานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  if (!supabase) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="brand-symbol">40</div>
          <p className="eyebrow">40FPS GANG MANAGEMENT</p>
          <h1>ยังไม่ได้เชื่อมต่อ Supabase</h1>
          <p>กรุณาตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน Environment Variables ของระบบ Deploy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-symbol">40</div>
          <div><strong>40FPS GANG</strong><span>MANAGEMENT SYSTEM</span></div>
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>

        <div className="sidebar-caption">เมนูจัดการ</div>
        <nav className="side-nav">
          {NAV.map(([id, label, Icon]) => (
            <button key={id} className={`nav-link ${tab === id ? "active" : ""}`}
              onClick={() => { setTab(id); setMobileOpen(false); setError(""); }}>
              <Icon size={18} /><span>{label}</span><ChevronRight className="nav-chevron" size={15} />
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {session && profile ? (
            <>
              <div className="profile-chip">
                <div className="profile-avatar">{profile.display_name?.slice(0, 1) || "4"}</div>
                <div className="profile-info"><b>{profile.display_name}</b><span>{roleName(role)}</span></div>
              </div>
              <button className="nav-link logout-link" onClick={handleLogout}><LogOut size={18} /><span>ออกจากระบบ</span></button>
            </>
          ) : (
            <button className="nav-link" onClick={() => setLoginOpen(true)}><Lock size={18} /><span>เข้าสู่ระบบผู้ดูแล</span></button>
          )}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div><span className="eyebrow">40FPS GANG / CONTROL CENTER</span><h1>{pageTitle}</h1></div>
          </div>
          <div className="topbar-actions">
            <span className="live-indicator"><i /> ระบบออนไลน์</span>
            <button className="icon-button" onClick={refresh} title="รีเฟรชข้อมูล"><RefreshCw size={17} /></button>
          </div>
        </header>

        {error && <div className="alert alert-error" role="alert"><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}
        {notice && <div className="alert alert-success" onClick={() => setNotice("")}><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
        {busy && <div className="busy-line" />}

        {tab === "overview" && (
          <section className="page-content">
            <div className="hero-card">
              <div><span className="eyebrow">WELCOME TO 40FPS</span><h2>{profile ? `ยินดีต้อนรับ ${profile.display_name}` : "40FPS GANG"}</h2><p>ศูนย์กลางจัดการข้อมูลและกิจกรรมของแก๊ง</p></div>
              <div className="hero-emblem"><ShieldCheck size={42} /></div>
            </div>
            <div className="stats-grid">
              <StatCard label="รายรับทั้งหมด" value={money(totalIncome)} Icon={ArrowDownLeft} tone="green" />
              <StatCard label="รายจ่ายทั้งหมด" value={money(totalExpenses)} Icon={ArrowUpRight} tone="red" />
              <StatCard label="ยอดคงเหลือ" value={money(totalIncome - totalExpenses)} Icon={Wallet} tone="purple" />
              <StatCard label="ส่งเงินสัปดาห์นี้" value={money(weeklyPaidTotal)} Icon={HandCoins} tone="gold" detail="เป้าหมายคนละ 50,000 บาท" />
            </div>
            <div className="content-grid two-columns">
              <section className="surface-card">
                <SectionHeading title="กิจกรรมล่าสุด" detail="สถานะการเช็คชื่อ" />
                {activities.length ? activities.map(activity => {
                  const count = attendance.filter(row => row.activity_id === activity.id).length;
                  return <div className="activity-overview-row" key={activity.id}><div className="mini-icon"><CalendarCheck size={18} /></div><div className="row-main"><b>{activity.activity_name}</b><small>{count} / {activeMembers.length} คนเช็คชื่อแล้ว</small></div><span className="soft-tag">กิจกรรม</span></div>;
                }) : <EmptyState text="ยังไม่มีกิจกรรมในระบบ" />}
              </section>
              <section className="surface-card">
                <SectionHeading title="ทางลัด" detail="ไปยังเมนูที่ต้องการ" />
                <div className="shortcut-grid">
                  {NAV.slice(1).map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)}><Icon size={20} /><span>{label}</span></button>)}
                </div>
              </section>
            </div>
          </section>
        )}

        {tab === "members" && (
          <section className="page-content">
            <Toolbar title="สมาชิกแก๊ง" description={`${activeMembers.length} สมาชิกที่กำลังใช้งาน`} search={search} setSearch={setSearch}
              action={isLeader ? () => openModal("member") : null} />
            <div className="surface-card table-card">
              <div className="table-scroll"><table><thead><tr><th>ชื่อสมาชิก</th><th>ตำแหน่ง</th><th>สถานะ</th>{isLeader && <th>จัดการ</th>}</tr></thead><tbody>
                {members.filter(member => member.display_name?.toLowerCase().includes(search.toLowerCase())).map(member => <tr key={member.id}>
                  <td className="strong-cell">{member.display_name}</td><td><span className={`role-pill ${member.role}`}>{roleName(member.role)}</span></td>
                  <td><span className={`status-pill ${member.status}`}>{member.status === "active" ? "ใช้งาน" : "ถอนสมาชิก"}</span></td>
                  {isLeader && <td><div className="table-actions"><button onClick={() => openModal("member", member)} title="แก้ไข"><Edit3 size={16} /></button><button onClick={() => saveRow("members", { status: member.status === "active" ? "withdrawn" : "active" }, member.id)} title="เปลี่ยนสถานะ"><RefreshCw size={16} /></button></div></td>}
                </tr>)}
                {!members.length && <tr><td colSpan={isLeader ? 4 : 3}><EmptyState text="ยังไม่มีข้อมูลสมาชิก" /></td></tr>}
              </tbody></table></div>
            </div>
          </section>
        )}

        {tab === "finance" && (
          <section className="page-content">
            <Toolbar title="บัญชีรายรับ–รายจ่าย" description={`ยอดคงเหลือ ${money(totalIncome - totalExpenses)}`} action={isAdmin ? () => openModal("finance") : null} />
            <div className="stats-grid compact-stats">
              <StatCard label="รายรับ" value={money(totalIncome)} Icon={ArrowDownLeft} tone="green" />
              <StatCard label="รายจ่าย" value={money(totalExpenses)} Icon={ArrowUpRight} tone="red" />
              <StatCard label="คงเหลือ" value={money(totalIncome - totalExpenses)} Icon={Wallet} tone="purple" />
            </div>
            <div className="content-grid two-columns">
              <DataPanel title="รายการรายรับ" rows={income} onDelete={isAdmin ? id => deleteRow("income", id) : null} />
              <DataPanel title="รายการรายจ่าย" rows={expenses} onDelete={isAdmin ? id => deleteRow("expenses", id) : null} />
            </div>
          </section>
        )}

        {tab === "payments" && (
          <section className="page-content">
            <Toolbar title="ส่งเงินรายสัปดาห์" description={`เป้าหมายสมาชิกคนละ ${money(WEEKLY_TARGET)} ต่อสัปดาห์ · เริ่มสัปดาห์ ${currentWeek}`} action={isAdmin ? () => openModal("payment") : null} />
            <div className="surface-card payment-banner"><div><span className="eyebrow">WEEKLY COLLECTION</span><h3>{money(weeklyPaidTotal)}</h3><p>ยอดส่งรวมของสมาชิกในสัปดาห์นี้ (เป้าหมายแยกคน)</p></div><div className="payment-banner-icon"><HandCoins size={30} /></div></div>
            <div className="surface-card table-card"><SectionHeading title="สรุปยอดรายสมาชิก" detail="เป้าหมาย 50,000 บาทต่อคนต่อสัปดาห์" /><div className="table-scroll"><table><thead><tr><th>สมาชิก</th><th>ส่งแล้ว</th><th>เป้าหมาย</th><th>คงเหลือ</th><th>ความคืบหน้า</th></tr></thead><tbody>
              {activeMembers.map(member => { const paid = paidByMember[member.id] || 0; const percent = Math.min(100, paid / WEEKLY_TARGET * 100); return <tr key={member.id}><td className="strong-cell">{member.display_name}</td><td>{money(paid)}</td><td>{money(WEEKLY_TARGET)}</td><td>{money(Math.max(0, WEEKLY_TARGET - paid))}</td><td><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><small>{percent.toFixed(0)}%</small></td></tr>; })}
            </tbody></table></div></div>
            <div className="surface-card table-card"><SectionHeading title="ประวัติการส่งเงิน" detail="รายการสัปดาห์ปัจจุบัน" /><div className="table-scroll"><table><thead><tr><th>สมาชิก</th><th>วันที่เริ่มสัปดาห์</th><th>ยอดส่ง</th>{isAdmin && <th>จัดการ</th>}</tr></thead><tbody>
              {payments.filter(row => row.week_start === currentWeek).map(row => <tr key={row.id}><td>{members.find(member => member.id === row.member_id)?.display_name || "สมาชิก"}</td><td>{row.week_start}</td><td>{money(row.amount)}</td>{isAdmin && <td><button className="danger-icon" onClick={() => deleteRow("weekly_payments", row.id)}><Trash2 size={16} /></button></td>}</tr>)}
              {!payments.some(row => row.week_start === currentWeek) && <tr><td colSpan={isAdmin ? 4 : 3}><EmptyState text="ยังไม่มีรายการส่งเงินสัปดาห์นี้" /></td></tr>}
            </tbody></table></div></div>
          </section>
        )}

        {tab === "deliveries" && (
          <section className="page-content">
            <Toolbar title="ส่งของแก๊ง" description="บันทึกและตรวจสอบประวัติการส่งของ" action={isAdmin ? () => openModal("delivery") : null} />
            <div className="surface-card table-card"><div className="table-scroll"><table><thead><tr><th>ผู้ส่ง</th><th>สิ่งของ</th><th>จำนวน</th><th>หมายเหตุ</th><th>วันที่</th>{isAdmin && <th>จัดการ</th>}</tr></thead><tbody>
              {deliveries.map(row => <tr key={row.id}><td>{row.sender_name || members.find(member => member.id === row.sender_member_id)?.display_name || "-"}</td><td className="strong-cell">{row.item_name}</td><td>{row.quantity} {UNIT_BY_ITEM[row.item_name] || ""}</td><td>{row.note || "-"}</td><td>{dateTH(row.created_at)}</td>{isAdmin && <td><button className="danger-icon" onClick={() => deleteRow("deliveries", row.id)}><Trash2 size={16} /></button></td>}</tr>)}
              {!deliveries.length && <tr><td colSpan={isAdmin ? 6 : 5}><EmptyState text="ยังไม่มีรายการส่งของ" /></td></tr>}
            </tbody></table></div></div>
          </section>
        )}

        {tab === "attendance" && (
          <section className="page-content">
            <Toolbar title="เช็คชื่อกิจกรรม" description="ติ๊กชื่อสมาชิกเพื่อบันทึกการเข้าร่วมกิจกรรมทันที" action={isAdmin ? () => openModal("activity") : null} actionLabel="เพิ่มกิจกรรม" />
            <div className="activity-checkin-grid">
              {activities.map(activity => {
                const records = attendance.filter(row => row.activity_id === activity.id);
                const presentCount = records.length;
                return <section className="surface-card attendance-card" key={activity.id}>
                  <div className="attendance-card-head"><div><span className="eyebrow">ACTIVITY CHECK-IN</span><h3>{activity.activity_name}</h3><p>{presentCount} / {activeMembers.length} คนเข้าร่วม</p></div>{isAdmin && <button className="danger-icon" title="ลบกิจกรรม" onClick={() => deleteRow("activities", activity.id)}><Trash2 size={17} /></button>}</div>
                  <div className="attendance-counts"><span className="count-present"><i /> มาแล้ว {presentCount} คน</span><span className="count-absent"><i /> ยังไม่มา {Math.max(0, activeMembers.length - presentCount)} คน</span></div>
                  <div className="attendance-list">
                    {activeMembers.map(member => {
                      const record = records.find(row => row.member_id === member.id);
                      return <label className={`attendance-person ${record ? "is-checked" : ""}`} key={member.id}>
                        <input type="checkbox" checked={!!record} disabled={!isAdmin || busy}
                          onChange={event => toggleAttendance(activity.id, member.id, record, event.target.checked)} />
                        <span className="custom-check"><CheckCircle2 size={16} /></span>
                        <span className="person-name">{member.display_name}</span>
                        <span className={`attendance-state ${record ? "done" : "waiting"}`}>{record ? "เช็คชื่อแล้ว" : "ยังไม่เช็ค"}</span>
                      </label>;
                    })}
                    {!activeMembers.length && <EmptyState text="ยังไม่มีสมาชิกที่เปิดใช้งาน" />}
                  </div>
                  {!isAdmin && <p className="readonly-note"><Lock size={14} /> บัญชีนี้ดูสถานะได้อย่างเดียว</p>}
                </section>;
              })}
              {!activities.length && <div className="surface-card empty-wide"><EmptyState text="ยังไม่มีกิจกรรมในระบบ ผู้ดูแลสามารถกดเพิ่มกิจกรรมได้" /></div>}
            </div>
          </section>
        )}

        {tab === "leave" && (
          <section className="page-content">
            <Toolbar title="ระบบแจ้งลา" description="ส่งคำขอลาได้โดยไม่ต้องเข้าสู่ระบบ" action={() => openModal("leave")} actionLabel="ส่งคำขอลา" />
            {isAdmin ? <div className="surface-card table-card"><SectionHeading title="คำขอลาสำหรับผู้ดูแล" detail="เหตุผลการลาแสดงเฉพาะ Leader และ Co-Leader" /><div className="table-scroll"><table><thead><tr><th>สมาชิก</th><th>วันที่ลา</th><th>เหตุผล</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
              {leaves.map(row => <tr key={row.id}><td>{members.find(member => member.id === row.member_id)?.display_name || "สมาชิก"}</td><td>{dateTH(row.leave_date)}</td><td>{row.reason}</td><td><span className={`leave-pill ${row.status}`}>{leaveStatus(row.status)}</span></td><td>{row.status === "pending" ? <div className="table-actions"><button className="approve-button" onClick={() => saveRow("leave_requests", { status: "approved" }, row.id)}>อนุมัติ</button><button className="reject-button" onClick={() => saveRow("leave_requests", { status: "rejected" }, row.id)}>ไม่อนุมัติ</button></div> : "—"}</td></tr>)}
              {!leaves.length && <tr><td colSpan="5"><EmptyState text="ยังไม่มีคำขอลา" /></td></tr>}
            </tbody></table></div></div> : <div className="surface-card table-card"><SectionHeading title="ประวัติการลา" detail="แสดงเฉพาะชื่อ วันที่ลา และสถานะ" /><div className="table-scroll"><table><thead><tr><th>สมาชิก</th><th>วันที่ลา</th><th>สถานะ</th></tr></thead><tbody>
              {publicLeaves.map((row, index) => <tr key={`${row.display_name}-${row.leave_date}-${index}`}><td>{row.display_name}</td><td>{dateTH(row.leave_date)}</td><td><span className={`leave-pill ${row.status}`}>{leaveStatus(row.status)}</span></td></tr>)}
              {!publicLeaves.length && <tr><td colSpan="3"><EmptyState text="ยังไม่มีประวัติการลา" /></td></tr>}
            </tbody></table></div></div>}
          </section>
        )}
        
        {tab === "kindofloop" && (
          <section className="page-content">
            <Toolbar
              title="Kind of Loop"
              description="ส่งหลักฐานเพื่อรับคะแนน +1 ต่อสมาชิกที่เลือก"
            />

            {session?.user?.id && (
              <div className="surface-card form-card">
                <SectionHeading
                  title="ส่งหลักฐานกิจกรรม"
                  detail="เลือกสมาชิกที่ได้รับคะแนนและวางลิงก์รูปหลักฐาน"
                />

                <form onSubmit={submitKindOfLoop} className="form-stack">
                  <div className="form-field">
                    <label>เลือกสมาชิกที่ได้รับคะแนน</label>
                    <div className="attendance-list">
                      {activeMembers.map(member => (
                        <label key={member.id} className="attendance-item">
                          <input
                            type="checkbox"
                            checked={kindOfLoopSelected.includes(member.display_name)}
                            onChange={event =>
                              setKindOfLoopSelected(prev =>
                                event.target.checked
                                  ? [...prev, member.display_name]
                                  : prev.filter(name => name !== member.display_name)
                              )
                            }
                          />
                          <span>{member.display_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-field">
                    <label>ลิงก์รูปหลักฐาน (HTTPS)</label>
                    <input
                      type="url"
                      value={kindOfLoopUrl}
                      onChange={event => setKindOfLoopUrl(event.target.value)}
                      placeholder="วางลิงก์รูปภาพที่นี่"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>หมายเหตุ (ถ้ามี)</label>
                    <textarea
                      value={kindOfLoopNote}
                      onChange={event => setKindOfLoopNote(event.target.value)}
                      placeholder="รายละเอียดเพิ่มเติม"
                    />
                  </div>

                  <button className="primary-button" type="submit" disabled={busy}>
                    {busy ? "กำลังบันทึก..." : "บันทึกคะแนน +1"}
                  </button>
                </form>
              </div>
            )}

            {!session?.user?.id && (
              <div className="surface-card">
                <p>กรุณาเข้าสู่ระบบก่อน จึงจะสามารถส่งหลักฐาน Kind of Loop ได้</p>
              </div>
            )}

            <div className="surface-card table-card">
              <SectionHeading title="อันดับคะแนน Kind of Loop" detail="เรียงตามคะแนนสะสมของสมาชิก" />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>อันดับ</th>
                      <th>สมาชิก</th>
                      <th>คะแนน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kindOfLoopLeaderboard.map((item, index) => (
                      <tr key={item.name}>
                        <td>{index + 1}</td>
                        <td>{item.name}</td>
                        <td>{item.points}</td>
                      </tr>
                    ))}
                    {!kindOfLoopLeaderboard.length && (
                      <tr>
                        <td colSpan="3">
                          <EmptyState text="ยังไม่มีคะแนน Kind of Loop" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="surface-card table-card">
              <SectionHeading title="ประวัติการส่งหลักฐาน" detail="ตรวจสอบสมาชิก คะแนน และหลักฐานย้อนหลัง" />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>สมาชิกที่ได้รับคะแนน</th>
                      <th>หมายเหตุ</th>
                      <th>หลักฐาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...kindOfLoopEntries]
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .map(entry => (
                        <tr key={entry.id}>
                          <td>{dateTH(entry.created_at)}</td>
                          <td>{(entry.selected_members || []).join(", ")}</td>
                          <td>{entry.note || "—"}</td>
                          <td>
                            <a href={entry.image_url} target="_blank" rel="noreferrer">
                              เปิดหลักฐาน
                            </a>
                          </td>
                        </tr>
                      ))}
                    {!kindOfLoopEntries.length && (
                      <tr>
                        <td colSpan="4">
                          <EmptyState text="ยังไม่มีประวัติหลักฐาน" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      {loginOpen && <Modal title="เข้าสู่ระบบผู้ดูแล" close={() => setLoginOpen(false)}><form className="form-stack" onSubmit={handleLogin}>
        <Field label="อีเมล"><input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></Field>
        <Field label="รหัสผ่าน"><input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></Field>
        <button className="button-primary full-width" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
      </form></Modal>}

      {modal && <Modal title={modalTitle(modal)} close={() => { setModal(""); setError(""); }}>
        <FormContent type={modal} form={form} setForm={setForm} members={activeMembers} editingId={editingId}
          onSubmit={async () => {
            if (modal === "leave") return submitLeave();
            if (modal === "member") return saveRow("members", {
              display_name: form.display_name?.trim(),
              role: form.role || "member",
              status: form.status || "active"
            }, editingId);
            if (modal === "finance") {
              const table = form.kind === "expense" ? "expenses" : "income";
              return saveRow(table, { item_name: form.item_name?.trim(), amount: Number(form.amount), recorded_by: profile?.id || null }, editingId);
            }
            if (modal === "payment") return saveRow("weekly_payments", {
              member_id: form.member_id, week_start: form.week_start || currentWeek, amount: Number(form.amount)
            }, editingId);
            if (modal === "delivery") return saveRow("deliveries", {
              sender_name: profile?.display_name || "ผู้ดูแล", sender_member_id: profile?.id || null,
              item_name: form.item_name, quantity: Number(form.quantity), note: form.note?.trim() || null
            }, editingId);
            if (modal === "activity") return saveRow("activities", { activity_name: form.activity_name?.trim() }, editingId);
          }} />
      </Modal>}
    </div>
  );
}

function modalTitle(type) {
  return ({ member: "จัดการสมาชิก", finance: "บันทึกรายรับ–รายจ่าย", payment: "บันทึกการส่งเงิน",
    delivery: "บันทึกส่งของ", activity: "เพิ่มกิจกรรม", leave: "ส่งคำขอลา" })[type] || "จัดการข้อมูล";
}

function StatCard({ label, value, Icon, tone, detail }) {
  return <div className="stat-card"><div className="stat-copy"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div><div className={`stat-icon ${tone}`}><Icon size={21} /></div></div>;
}

function Toolbar({ title, description, action, actionLabel = "เพิ่มรายการ", search, setSearch }) {
  return <div className="page-toolbar"><div><h2>{title}</h2><p>{description}</p></div><div className="toolbar-tools">
    {search !== undefined && <div className="search-box"><Search size={16} /><input placeholder="ค้นหาสมาชิก" value={search} onChange={event => setSearch(event.target.value)} /></div>}
    {action && <button className="button-primary" onClick={action}><Plus size={17} />{actionLabel}</button>}
  </div></div>;
}

function SectionHeading({ title, detail }) {
  return <div className="section-heading"><div><h3>{title}</h3>{detail && <p>{detail}</p>}</div></div>;
}

function DataPanel({ title, rows, onDelete }) {
  return <section className="surface-card data-panel"><SectionHeading title={title} detail={`${rows.length} รายการ`} />
    {rows.slice(0, 100).map(row => <div className="finance-row" key={row.id}><div className="finance-row-icon"><Wallet size={17} /></div><div className="finance-row-copy"><b>{row.item_name}</b><small>{dateTH(row.created_at)}</small></div><strong>{money(row.amount)}</strong>{onDelete && <button className="danger-icon" onClick={() => onDelete(row.id)}><Trash2 size={16} /></button>}</div>)}
    {!rows.length && <EmptyState text="ยังไม่มีรายการ" />}
  </section>;
}

function EmptyState({ text }) {
  return <div className="empty-state"><ClipboardList size={24} /><span>{text}</span></div>;
}

function Modal({ title, close, children }) {
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal-card" onMouseDown={event => event.stopPropagation()}>
    <div className="modal-heading"><h3>{title}</h3><button className="icon-button" onClick={close}><X size={18} /></button></div>{children}
  </div></div>;
}

function Field({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function FormContent({ type, form, setForm, members, editingId, onSubmit }) {
  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const [customItem, setCustomItem] = useState(false);
  return <form className="form-stack" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    {type === "member" && <>
      <Field label="ชื่อสมาชิก"><input value={form.display_name || ""} onChange={event => update("display_name", event.target.value)} required /></Field>
      <Field label="ตำแหน่ง"><select value={form.role || "member"} onChange={event => update("role", event.target.value)}><option value="member">Member</option><option value="co_leader">Co-Leader</option><option value="leader">Leader</option></select></Field>
      <Field label="สถานะ"><select value={form.status || "active"} onChange={event => update("status", event.target.value)}><option value="active">ใช้งาน</option><option value="withdrawn">ถอนสมาชิก</option></select></Field>
    </>}
    {type === "finance" && <>
      <Field label="ประเภทรายการ"><select value={form.kind || "income"} onChange={event => update("kind", event.target.value)}><option value="income">รายรับ</option><option value="expense">รายจ่าย</option></select></Field>
      <Field label="ชื่อรายการ"><input value={form.item_name || ""} onChange={event => update("item_name", event.target.value)} required /></Field>
      <Field label="จำนวนเงิน (บาท)"><input type="number" min="1" value={form.amount || ""} onChange={event => update("amount", event.target.value)} required /></Field>
    </>}
    {type === "payment" && <>
      <Field label="สมาชิก"><select value={form.member_id || ""} onChange={event => update("member_id", event.target.value)} required><option value="">เลือกสมาชิก</option>{members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></Field>
      <Field label="วันเริ่มสัปดาห์"><input type="date" value={form.week_start || getWeekStart()} onChange={event => update("week_start", event.target.value)} required /></Field>
      <Field label="จำนวนเงิน (บาท)"><input type="number" min="1" value={form.amount || ""} onChange={event => update("amount", event.target.value)} required /></Field>
      <p className="form-hint">เป้าหมาย 50,000 บาทต่อสมาชิกหนึ่งคนต่อสัปดาห์</p>
    </>}
    {type === "delivery" && <>
      <Field label="สิ่งของ"><select value={customItem ? "__custom" : form.item_name || ""} onChange={event => { if (event.target.value === "__custom") { setCustomItem(true); update("item_name", ""); } else { setCustomItem(false); update("item_name", event.target.value); } }} required><option value="">เลือกสิ่งของ</option>{DELIVERY_ITEMS.map(item => <option key={item} value={item}>{item} ({UNIT_BY_ITEM[item]})</option>)}<option value="__custom">+ ระบุรายการอื่น</option></select></Field>
      {customItem && <Field label="ชื่อสิ่งของอื่น"><input value={form.item_name || ""} onChange={event => update("item_name", event.target.value)} required /></Field>}
      <Field label={`จำนวน ${UNIT_BY_ITEM[form.item_name] ? `(${UNIT_BY_ITEM[form.item_name]})` : ""}`}><input type="number" min="1" value={form.quantity || ""} onChange={event => update("quantity", event.target.value)} required /></Field>
      <Field label="หมายเหตุ"><textarea rows="3" value={form.note || ""} onChange={event => update("note", event.target.value)} /></Field>
    </>}
    
    {type === "activity" && <Field label="ชื่อกิจกรรม"><input value={form.activity_name || ""} onChange={event => update("activity_name", event.target.value)} placeholder="เช่น กิจกรรมประจำสัปดาห์" required /></Field>}
    {type === "leave" && <>
      <Field label="ชื่อสมาชิก"><select value={form.member_id || ""} onChange={event => update("member_id", event.target.value)} required><option value="">เลือกสมาชิก</option>{members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></Field>
      <Field label="วันที่ลา"><input type="date" value={form.leave_date || ""} onChange={event => update("leave_date", event.target.value)} required /></Field>
      <Field label="เหตุผล"><textarea rows="3" value={form.reason || ""} onChange={event => update("reason", event.target.value)} required /></Field>
      <p className="form-hint">เหตุผลการลาจะเห็นได้เฉพาะ Leader และ Co-Leader</p>
    </>}
    <button className="button-primary full-width" type="submit">{editingId ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</button>
  </form>;
}
