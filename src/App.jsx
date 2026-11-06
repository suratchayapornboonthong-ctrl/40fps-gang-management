
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard, Wallet, HandCoins, Package, Users,
  CalendarCheck, CalendarDays, LogOut, Plus, RefreshCw,
  Search, Menu, X, ShieldCheck, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, Trash2, Edit3, Lock
} from "lucide-react";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

const WEEKLY_TARGET = 50000;

const money = n =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(Number(n || 0));

const nav = [
  ["overview", "ภาพรวม", "layout"],
  ["members", "สมาชิก", "users"],
  ["finance", "บัญชีรายรับ-รายจ่าย", "wallet"],
  ["payments", "ส่งเงินรายสัปดาห์", "coins"],
  ["deliveries", "ส่งของแก๊ง", "package"],
  ["attendance", "เช็คชื่อกิจกรรม", "calendar"],
  ["leave", "แจ้งลา", "days"]
];

const icons = {
  layout: LayoutDashboard,
  users: Users,
  wallet: Wallet,
  coins: HandCoins,
  package: Package,
  calendar: CalendarCheck,
  days: CalendarDays
};

const REALTIME_TABLES = [
  "members",
  "income",
  "expenses",
  "weekly_payments",
  "deliveries",
  "activities",
  "attendance"
];

function getWeekStart() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

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

  const [modal, setModal] = useState("");
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  const role = profile?.role || "public";
  const admin = ["leader", "co_leader"].includes(role);
  const leader = role === "leader";

  const active = members.filter(m => m.status === "active");

  const totalIn = income.reduce(
    (sum, item) => sum + Number(item.amount || 0), 0
  );

  const totalOut = expenses.reduce(
    (sum, item) => sum + Number(item.amount || 0), 0
  );

  const currentWeek = getWeekStart();

  const paidByMember = useMemo(() => {
    const result = {};

    payments
      .filter(p => p.week_start === currentWeek)
      .forEach(p => {
        result[p.member_id] =
          (result[p.member_id] || 0) + Number(p.amount || 0);
      });

    return result;
  }, [payments, currentWeek]);

  const paidTotal = Object.values(paidByMember).reduce(
    (sum, amount) => sum + amount, 0
  );

  const title = nav.find(n => n[0] === tab)?.[1] || "ภาพรวม";

  // ตรวจสอบสถานะการเข้าสู่ระบบ
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setErr(error.message);
        return;
      }

      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // โหลดข้อมูลทั้งหมด
  const loadAll = useCallback(async () => {
    if (!supabase) return;

    setBusy(true);
    setErr("");

    try {
      let currentProfile = null;

      if (session?.user?.id) {
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          await supabase.auth.signOut();
          throw new Error(
            "บัญชีนี้ยังไม่ได้ผูกกับรายชื่อสมาชิก กรุณาติดต่อ Leader"
          );
        }

        currentProfile = data;
      }

      setProfile(currentProfile);

      const canManage = ["leader", "co_leader"].includes(
        currentProfile?.role
      );

      const publicTables = [
        ["members", setMembers],
        ["income", setIncome],
        ["expenses", setExpenses],
        ["weekly_payments", setPayments],
        ["deliveries", setDeliveries],
        ["activities", setActivities],
        ["attendance", setAttendance]
      ];

      for (const [table, setter] of publicTables) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .limit(500);

        if (error) {
          console.error(`โหลด ${table} ไม่สำเร็จ:`, error.message);
        } else {
          setter(data || []);
        }
      }

      // ประวัติการลาแบบสาธารณะ
      // View นี้ต้องเปิดเผยเฉพาะชื่อ วันที่ และสถานะ
      const publicLeaveResult = await supabase
        .from("public_leave_history")
        .select("*")
        .order("leave_date", { ascending: false })
        .limit(500);

      if (publicLeaveResult.error) {
        console.error(
          "โหลดประวัติการลาไม่สำเร็จ:",
          publicLeaveResult.error.message
        );
      } else {
        setPublicLeaves(publicLeaveResult.data || []);
      }

      // เหตุผลการลาโหลดเฉพาะผู้ดูแล
      if (canManage) {
        const { data, error } = await supabase
          .from("leave_requests")
          .select("*")
          .order("leave_date", { ascending: false })
          .limit(500);

        if (error) {
          console.error("โหลดคำขอลาไม่สำเร็จ:", error.message);
        } else {
          setLeaves(data || []);
        }
      } else {
        setLeaves([]);
      }
    } catch (e) {
      setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }, [session]);

  useEffect(() => {
    if (supabase) loadAll();
  }, [loadAll]);

  // อัปเดตข้อมูลหลักแบบ Realtime
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel("40fps-live-updates");

    REALTIME_TABLES.forEach(table => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table
        },
        () => loadAll()
      );
    });

    channel.subscribe();

    // View ประวัติการลาไม่รองรับ Postgres Changes โดยตรง
    // จึงโหลดข้อมูลใหม่ทุก 30 วินาที
    const leaveTimer = window.setInterval(async () => {
      const { data, error } = await supabase
        .from("public_leave_history")
        .select("*")
        .order("leave_date", { ascending: false })
        .limit(500);

      if (!error) {
        setPublicLeaves(data || []);
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(leaveTimer);
    };
  }, [loadAll]);

  async function signIn(e) {
    e.preventDefault();

    setBusy(true);
    setErr("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setErr(error.message);
    } else {
      setShowLogin(false);
      setPassword("");
    }

    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();

    setProfile(null);
    setSession(null);
    setShowLogin(false);
    setTab("overview");
  }

  async function save(table, values, id) {
    if (!admin) {
      setErr("เฉพาะ Leader และ Co-Leader เท่านั้นที่บันทึกข้อมูลได้");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      const query = id
        ? supabase.from(table).update(values).eq("id", id)
        : supabase.from(table).insert(values);

      const { error } = await query;

      if (error) throw error;

      setNotice("บันทึกข้อมูลเรียบร้อยแล้ว");
      setModal("");
      setEditing(null);
      setForm({});

      await loadAll();
    } catch (e) {
      setErr(e.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(table, id) {
    if (!admin) {
      setErr("ไม่มีสิทธิ์ลบข้อมูล");
      return;
    }

    if (!window.confirm("ยืนยันลบรายการนี้?")) return;

    setBusy(true);

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id);

    if (error) {
      setErr(error.message);
    } else {
      setNotice("ลบรายการแล้ว");
      await loadAll();
    }

    setBusy(false);
  }

  function openForm(type, row = null) {
    if (type === "member" && !leader) {
      setErr("เฉพาะ Leader เท่านั้นที่จัดการสมาชิกได้");
      return;
    }

    if (
      !["leave"].includes(type) &&
      !admin
    ) {
      setErr("เฉพาะ Leader และ Co-Leader เท่านั้น");
      return;
    }

    setEditing(row?.id || null);
    setForm(row ? { ...row } : {});
    setModal(type);
    setErr("");
  }

  async function submitLeave() {
    if (!form.member_id || !form.leave_date || !form.reason?.trim()) {
      setErr("กรุณากรอกชื่อสมาชิก วันที่ลา และเหตุผล");
      return;
    }

    setBusy(true);
    setErr("");

    const { error } = await supabase
      .from("leave_requests")
      .insert({
        member_id: form.member_id,
        leave_date: form.leave_date,
        reason: form.reason.trim(),
        status: "pending"
      });

    if (error) {
      setErr("ส่งคำขอลาไม่สำเร็จ: " + error.message);
    } else {
      setNotice("ส่งคำขอลาเรียบร้อยแล้ว กรุณารอผู้ดูแลตรวจสอบ");
      setModal("");
      setForm({});

      // โหลดประวัติสาธารณะใหม่
      const { data } = await supabase
        .from("public_leave_history")
        .select("*")
        .order("leave_date", { ascending: false })
        .limit(500);

      if (data) setPublicLeaves(data);

      if (admin) await loadAll();
    }

    setBusy(false);
  }

  if (!supabase) {
    return (
      <div className="setup">
        <div className="login-card">
          <div className="brand-mark">40</div>
          <h1>40FPS GANG</h1>
          <p>ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase</p>
          <p className="muted">
            ตรวจสอบ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark small">40</div>
          <div>
            <b>40FPS GANG</b>
            <small>MANAGEMENT</small>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>

        <div className="nav-label">เมนูหลัก</div>

        {nav.map(([id, label, ic]) => {
          const Icon = icons[ic];

          return (
            <button
              key={id}
              className={"nav-item " + (tab === id ? "selected" : "")}
              onClick={() => {
                setTab(id);
                setMobile(false);
                setErr("");
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}

        <div className="sidebar-bottom">
          {admin ? (
            <>
              <div className="user-chip">
                <div className="avatar">
                  {profile?.display_name?.[0] || "4"}
                </div>
                <div>
                  <b>{profile?.display_name}</b>
                  <small>
                    {role === "leader" ? "Leader" : "Co-Leader"}
                  </small>
                </div>
              </div>

              <button className="nav-item" onClick={signOut}>
                <LogOut size={18} />
                ออกจากระบบ
              </button>
            </>
          ) : (
            <button
              className="nav-item"
              onClick={() => setShowLogin(true)}
            >
              <Lock size={18} />
              เข้าสู่ระบบผู้ดูแล
            </button>
          )}
        </div>
      </aside>

      <main className="main">
        <header>
          <button
            className="icon-btn menu-btn"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>

          <div>
            <p className="eyebrow">40FPS GANG / MANAGEMENT</p>
            <h2>{title}</h2>
          </div>

          <div className="header-right">
            <span className="online"><i /> ONLINE</span>
            <button
              className="icon-btn"
              onClick={loadAll}
              title="รีเฟรช"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {err && (
          <div className="error banner">{err}</div>
        )}

        {notice && (
          <div
            className="success banner"
            onClick={() => setNotice("")}
          >
            {notice} ×
          </div>
        )}

        {busy && <div className="loading-line" />}

        {tab === "overview" && (
          <>
            <div className="welcome">
              <div>
                <p className="eyebrow">WELCOME TO 40FPS</p>
                <h1>
                  {admin
                    ? `สวัสดี, ${profile?.display_name}`
                    : "40FPS GANG"}
                </h1>
                <p>ภาพรวมการจัดการแก๊ง 40FPS</p>
              </div>
              <ShieldCheck size={48} />
            </div>

            <div className="stats">
              <Stat
                title="รายรับทั้งหมด"
                value={money(totalIn)}
                icon={ArrowDownLeft}
                tone="green"
              />
              <Stat
                title="รายจ่ายทั้งหมด"
                value={money(totalOut)}
                icon={ArrowUpRight}
                tone="red"
              />
              <Stat
                title="เงินคงเหลือ"
                value={money(totalIn - totalOut)}
                icon={Wallet}
                tone="purple"
              />
              <Stat
                title="ยอดส่งเงินรวมสัปดาห์นี้"
                value={money(paidTotal)}
                sub="คิดแยกเป้าหมายคนละ 50,000 บาท"
                icon={HandCoins}
                tone="gold"
              />
            </div>

            <div className="grid-two">
              <section className="panel">
                <PanelTitle
                  title="กิจกรรมเช็คชื่อ"
                  subtitle="สถานะการเข้าร่วม"
                />

                {activities.map(a => (
                  <div className="activity-row" key={a.id}>
                    <div className="activity-icon">
                      <CalendarCheck />
                    </div>
                    <div>
                      <b>{a.activity_name}</b>
                      <small>
                        {attendance.filter(
                          x => x.activity_id === a.id
                        ).length} คนเช็คชื่อแล้ว
                      </small>
                    </div>
                    <span className="tag">กิจกรรม</span>
                  </div>
                ))}

                {activities.length === 0 && (
                  <p className="muted">ยังไม่มีกิจกรรม</p>
                )}
              </section>

              <section className="panel">
                <PanelTitle
                  title="เมนูด่วน"
                  subtitle="เลือกดูข้อมูล"
                />
                <div className="quick-grid">
                  {nav.slice(1).map(n => (
                    <button
                      onClick={() => setTab(n[0])}
                      key={n[0]}
                    >
                      {React.createElement(icons[n[2]], {
                        size: 20
                      })}
                      <span>{n[1]}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {tab === "members" && (
          <>
            <Toolbar
              title="รายชื่อสมาชิก"
              desc={`${active.length} สมาชิกที่ใช้งาน`}
              action={leader ? () => openForm("member") : null}
              search={search}
              setSearch={setSearch}
            />

            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ชื่อสมาชิก</th>
                    <th>ตำแหน่ง</th>
                    <th>สถานะ</th>
                    {leader && <th>จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {members
                    .filter(m =>
                      m.display_name?.toLowerCase().includes(
                        search.toLowerCase()
                      )
                    )
                    .map(m => (
                      <tr key={m.id}>
                        <td><b>{m.display_name}</b></td>
                        <td>{roleLabel(m.role)}</td>
                        <td>
                          <span className={"status " + m.status}>
                            {m.status === "active"
                              ? "ใช้งาน"
                              : "ถอนสมาชิก"}
                          </span>
                        </td>

                        {leader && (
                          <td className="actions">
                            <button
                              onClick={() => openForm("member", m)}
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() =>
                                save(
                                  "members",
                                  {
                                    status:
                                      m.status === "active"
                                        ? "withdrawn"
                                        : "active"
                                  },
                                  m.id
                                )
                              }
                            >
                              <RefreshCw size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}

                  {members.length === 0 && (
                    <tr>
                      <td colSpan={leader ? 4 : 3}>
                        ยังไม่มีข้อมูลสมาชิก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "finance" && (
          <>
            <Toolbar
              title="บัญชีรายรับ-รายจ่าย"
              desc={`คงเหลือ ${money(totalIn - totalOut)}`}
              action={admin ? () => openForm("finance") : null}
            />

            <div className="stats compact">
              <Stat title="รายรับ" value={money(totalIn)} tone="green" />
              <Stat title="รายจ่าย" value={money(totalOut)} tone="red" />
              <Stat title="คงเหลือ" value={money(totalIn - totalOut)} tone="purple" />
            </div>

            <div className="grid-two">
              <DataTable
                title="รายรับ"
                rows={income}
                field="item_name"
                onDelete={admin ? id => remove("income", id) : null}
              />
              <DataTable
                title="รายจ่าย"
                rows={expenses}
                field="item_name"
                onDelete={admin ? id => remove("expenses", id) : null}
              />
            </div>
          </>
        )}

        {tab === "payments" && (
          <>
            <Toolbar
              title="ส่งเงินรายสัปดาห์"
              desc={`เป้าหมายคนละ ${money(WEEKLY_TARGET)} / สัปดาห์ · เริ่ม ${currentWeek}`}
              action={admin ? () => openForm("payment") : null}
            />

            <div className="panel progress-panel">
              <div className="progress-head">
                <b>ยอดส่งรวมของสมาชิกสัปดาห์นี้</b>
                <strong>{money(paidTotal)}</strong>
              </div>
              <small>
                เป้าหมายคิดแยกสมาชิกแต่ละคน คนละ 50,000 บาท
              </small>
            </div>

            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>สมาชิก</th>
                    <th>ส่งแล้ว</th>
                    <th>เป้าหมาย</th>
                    <th>คงเหลือ</th>
                    <th>ความคืบหน้า</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(m => {
                    const paid = paidByMember[m.id] || 0;
                    const remaining = Math.max(0, WEEKLY_TARGET - paid);
                    const percent = Math.min(
                      100,
                      paid / WEEKLY_TARGET * 100
                    );

                    return (
                      <tr key={m.id}>
                        <td><b>{m.display_name}</b></td>
                        <td>{money(paid)}</td>
                        <td>{money(WEEKLY_TARGET)}</td>
                        <td>{money(remaining)}</td>
                        <td>
                          <div className="progress">
                            <i style={{ width: percent + "%" }} />
                          </div>
                          <small>{percent.toFixed(0)}%</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="panel table-wrap">
              <PanelTitle
                title="ประวัติการส่งเงิน"
                subtitle="รายการของสัปดาห์ปัจจุบัน"
              />
              <table>
                <thead>
                  <tr>
                    <th>สมาชิก</th>
                    <th>สัปดาห์</th>
                    <th>ยอดส่ง</th>
                    {admin && <th>จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {payments
                    .filter(p => p.week_start === currentWeek)
                    .map(p => (
                      <tr key={p.id}>
                        <td>
                          {members.find(m => m.id === p.member_id)
                            ?.display_name || "สมาชิก"}
                        </td>
                        <td>{p.week_start}</td>
                        <td>{money(p.amount)}</td>
                        {admin && (
                          <td className="actions">
                            <button
                              onClick={() =>
                                remove("weekly_payments", p.id)
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "deliveries" && (
          <>
            <Toolbar
              title="รายการส่งของแก๊ง"
              desc="ประวัติรายการส่งของ"
              action={admin ? () => openForm("delivery") : null}
            />

            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ผู้ส่ง</th>
                    <th>สิ่งของ</th>
                    <th>จำนวน</th>
                    <th>วันที่</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id}>
                      <td>{d.sender_name}</td>
                      <td>{d.item_name}</td>
                      <td>{d.quantity}</td>
                      <td>
                        {d.created_at
                          ? new Date(d.created_at).toLocaleDateString("th-TH")
                          : "-"}
                      </td>
                    </tr>
                  ))}

                  {deliveries.length === 0 && (
                    <tr>
                      <td colSpan="4">ยังไม่มีรายการส่งของ</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "attendance" && (
          <>
            <Toolbar
              title="เช็คชื่อกิจกรรม"
              desc="เฉพาะ Leader และ Co-Leader เช็คชื่อให้สมาชิก"
            />

            <div className="activity-cards">
              {activities.map(a => (
                <section className="panel" key={a.id}>
                  <PanelTitle
                    title={a.activity_name}
                    subtitle={`${
                      attendance.filter(
                        x => x.activity_id === a.id
                      ).length
                    } คนเช็คชื่อแล้ว`}
                  />

                  {admin && (
                    <button
                      className="primary"
                      onClick={() => {
                        setForm({
                          activity_id: a.id,
                          member_id: active[0]?.id || ""
                        });
                        setModal("attendance");
                      }}
                    >
                      <Plus size={16} />
                      เช็คชื่อสมาชิก
                    </button>
                  )}

                  <div className="att-list">
                    {attendance
                      .filter(x => x.activity_id === a.id)
                      .map(x => (
                        <div key={x.id}>
                          <CheckCircle2 size={16} />
                          {members.find(m => m.id === x.member_id)
                            ?.display_name || "สมาชิก"}
                          <small>
                            {x.checked_at
                              ? new Date(x.checked_at).toLocaleString("th-TH")
                              : ""}
                          </small>
                        </div>
                      ))}
                  </div>
                </section>
              ))}

              {activities.length === 0 && (
                <div className="panel">
                  ยังไม่มีกิจกรรมในระบบ
                </div>
              )}
            </div>
          </>
        )}

        {tab === "leave" && (
          <>
            <Toolbar
              title="ระบบแจ้งลา"
              desc="บุคคลทั่วไปส่งคำขอลาได้ โดยไม่ต้องเข้าสู่ระบบ"
              action={() => openForm("leave")}
            />

            {admin ? (
              <div className="panel table-wrap">
                <PanelTitle
                  title="คำขอลาสำหรับผู้ดูแล"
                  subtitle="ข้อมูลนี้เห็นได้เฉพาะ Leader และ Co-Leader"
                />

                <table>
                  <thead>
                    <tr>
                      <th>สมาชิก</th>
                      <th>วันที่ลา</th>
                      <th>เหตุผล</th>
                      <th>สถานะ</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map(l => (
                      <tr key={l.id}>
                        <td>
                          {members.find(m => m.id === l.member_id)
                            ?.display_name || "สมาชิก"}
                        </td>
                        <td>{l.leave_date}</td>
                        <td>{l.reason}</td>
                        <td>{leaveLabel(l.status)}</td>
                        <td className="actions">
                          {l.status === "pending" && (
                            <>
                              <button
                                onClick={() =>
                                  save(
                                    "leave_requests",
                                    { status: "approved" },
                                    l.id
                                  )
                                }
                              >
                                อนุมัติ
                              </button>
                              <button
                                onClick={() =>
                                  save(
                                    "leave_requests",
                                    { status: "rejected" },
                                    l.id
                                  )
                                }
                              >
                                ไม่อนุมัติ
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}

                    {leaves.length === 0 && (
                      <tr>
                        <td colSpan="5">ยังไม่มีคำขอลา</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="panel">
                  <PanelTitle
                    title="แจ้งลาออนไลน์"
                    subtitle="ส่งคำขอลาให้ผู้ดูแลตรวจสอบ"
                  />
                  <p className="muted">
                    บุคคลทั่วไปส่งคำขอได้ โดยไม่ต้องเข้าสู่ระบบ
                  </p>
                  <button
                    className="primary"
                    onClick={() => openForm("leave")}
                  >
                    + ส่งคำขอลา
                  </button>
                </div>

                <div className="panel table-wrap">
                  <PanelTitle
                    title="ประวัติการลา"
                    subtitle="แสดงเฉพาะชื่อ วันที่ลา และสถานะ"
                  />

                  <table>
                    <thead>
                      <tr>
                        <th>สมาชิก</th>
                        <th>วันที่ลา</th>
                        <th>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publicLeaves.map((l, index) => (
                        <tr
                          key={`${l.display_name}-${l.leave_date}-${index}`}
                        >
                          <td>{l.display_name}</td>
                          <td>{l.leave_date}</td>
                          <td>{leaveLabel(l.status)}</td>
                        </tr>
                      ))}

                      {publicLeaves.length === 0 && (
                        <tr>
                          <td colSpan="3">ยังไม่มีประวัติการลา</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {showLogin && (
          <Modal
            title="เข้าสู่ระบบผู้ดูแล"
            close={() => {
              setShowLogin(false);
              setErr("");
            }}
          >
            <form className="form-body" onSubmit={signIn}>
              <label>
                อีเมล
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>

              <label>
                รหัสผ่าน
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </label>

              <button className="primary full" disabled={busy}>
                {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </button>
            </form>
          </Modal>
        )}

        {modal && (
          <Modal
            title={modalTitle(modal)}
            close={() => {
              setModal("");
              setErr("");
            }}
          >
            <FormModal
              type={modal}
              form={form}
              setForm={setForm}
              members={active}
              activities={activities}
              role={role}
              onSave={async () => {
                if (modal === "leave") {
                  return submitLeave();
                }

                if (!admin) {
                  return setErr("ไม่มีสิทธิ์บันทึกข้อมูล");
                }

                if (modal === "member") {
                  const vals = {
                    display_name: form.display_name,
                    role: form.role || "member",
                    status: form.status || "active"
                  };

                  await save("members", vals, editing);
                }

                if (modal === "finance") {
                  await save(
                    form.kind === "expense" ? "expenses" : "income",
                    {
                      item_name: form.item_name,
                      amount: Number(form.amount),
                      recorded_by: profile.id
                    }
                  );
                }

                if (modal === "payment") {
                  await save("weekly_payments", {
                    member_id: form.member_id,
                    week_start: form.week_start || currentWeek,
                    amount: Number(form.amount)
                  });
                }

                if (modal === "delivery") {
                  await save("deliveries", {
                    sender_name: profile.display_name,
                    sender_member_id: profile.id,
                    item_name: form.item_name,
                    quantity: Number(form.quantity),
                    note: form.note || null
                  });
                }

                if (modal === "attendance") {
                  await save("attendance", {
                    activity_id: form.activity_id,
                    member_id: form.member_id
                  });
                }
              }}
            />
          </Modal>
        )}
      </main>
    </div>
  );
}

function roleLabel(role) {
  return role === "leader"
    ? "Leader"
    : role === "co_leader"
      ? "Co-Leader"
      : "Member";
}

function leaveLabel(status) {
  return status === "approved"
    ? "อนุมัติแล้ว"
    : status === "rejected"
      ? "ไม่อนุมัติ"
      : "รอตรวจสอบ";
}

function modalTitle(type) {
  return {
    member: "เพิ่ม / แก้ไขสมาชิก",
    finance: "บันทึกรายรับ-รายจ่าย",
    payment: "บันทึกการส่งเงิน",
    delivery: "บันทึกส่งของ",
    attendance: "เช็คชื่อสมาชิก",
    leave: "ยื่นคำขอลา"
  }[type] || "บันทึกข้อมูล";
}

function Stat({ title, value, icon: Icon, tone = "purple", sub }) {
  return (
    <div className="stat">
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        {sub && <em>{sub}</em>}
      </div>
      {Icon && (
        <div className={"stat-icon " + tone}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}

function PanelTitle({ title, subtitle }) {
  return (
    <div className="panel-title">
      <div>
        <b>{title}</b>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

function Toolbar({ title, desc, action, search, setSearch }) {
  return (
    <div className="toolbar">
      <div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>

      <div className="toolbar-actions">
        {search !== undefined && (
          <div className="search">
            <Search size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาสมาชิก"
            />
          </div>
        )}

        {action && (
          <button className="primary" onClick={action}>
            <Plus size={16} />
            เพิ่มรายการ
          </button>
        )}
      </div>
    </div>
  );
}

function DataTable({ title, rows, field, onDelete }) {
  return (
    <section className="panel">
      <PanelTitle
        title={title}
        subtitle={`${rows.length} รายการ`}
      />

      {rows.slice(0, 30).map(r => (
        <div className="data-row" key={r.id}>
          <div>
            <b>{r[field]}</b>
            <small>
              {r.created_at
                ? new Date(r.created_at).toLocaleDateString("th-TH")
                : ""}
            </small>
          </div>

          <strong>{money(r.amount)}</strong>

          {onDelete && (
            <button
              className="plain-btn"
              onClick={() => onDelete(r.id)}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}

      {rows.length === 0 && (
        <p className="muted">ยังไม่มีรายการ</p>
      )}
    </section>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <b>{title}</b>
          <button className="icon-btn" onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormModal({
  type,
  form,
  setForm,
  members,
  activities,
  role,
  onSave
}) {
  const set = (key, value) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="form-body">
      {type === "member" && (
        <>
          <label>
            ชื่อที่แสดง
            <input
              value={form.display_name || ""}
              onChange={e => set("display_name", e.target.value)}
              required
            />
          </label>

          {role === "leader" && (
            <label>
              ตำแหน่ง
              <select
                value={form.role || "member"}
                onChange={e => set("role", e.target.value)}
              >
                <option value="member">Member</option>
                <option value="co_leader">Co-Leader</option>
                <option value="leader">Leader</option>
              </select>
            </label>
          )}

          <label>
            สถานะ
            <select
              value={form.status || "active"}
              onChange={e => set("status", e.target.value)}
            >
              <option value="active">ใช้งาน</option>
              <option value="withdrawn">ถอนสมาชิก</option>
            </select>
          </label>
        </>
      )}

      {type === "finance" && (
        <>
          <label>
            ประเภท
            <select
              value={form.kind || "income"}
              onChange={e => set("kind", e.target.value)}
            >
              <option value="income">รายรับ</option>
              <option value="expense">รายจ่าย</option>
            </select>
          </label>

          <label>
            ชื่อรายการ
            <input
              value={form.item_name || ""}
              onChange={e => set("item_name", e.target.value)}
              required
            />
          </label>

          <label>
            จำนวนเงิน
            <input
              type="number"
              min="1"
              value={form.amount || ""}
              onChange={e => set("amount", e.target.value)}
              required
            />
          </label>
        </>
      )}

      {type === "payment" && (
        <>
          <label>
            สมาชิก
            <select
              value={form.member_id || ""}
              onChange={e => set("member_id", e.target.value)}
              required
            >
              <option value="">-- เลือกสมาชิก --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            วันที่เริ่มสัปดาห์
            <input
              type="date"
              value={form.week_start || ""}
              onChange={e => set("week_start", e.target.value)}
              required
            />
          </label>

          <label>
            จำนวนเงิน
            <input
              type="number"
              min="1"
              value={form.amount || ""}
              onChange={e => set("amount", e.target.value)}
              required
            />
          </label>

          <p className="hint">
            เป้าหมายของสมาชิกคนนี้คือ 50,000 บาทต่อสัปดาห์
          </p>
        </>
      )}

      {type === "delivery" && (
        <>
          <label>
            ชื่อสิ่งของ
            <input
              value={form.item_name || ""}
              onChange={e => set("item_name", e.target.value)}
              required
            />
          </label>

          <label>
            จำนวน
            <input
              type="number"
              min="1"
              value={form.quantity || ""}
              onChange={e => set("quantity", e.target.value)}
              required
            />
          </label>

          <label>
            หมายเหตุ
            <input
              value={form.note || ""}
              onChange={e => set("note", e.target.value)}
            />
          </label>
        </>
      )}

      {type === "attendance" && (
        <>
          <label>
            กิจกรรม
            <select
              value={form.activity_id || ""}
              onChange={e => set("activity_id", e.target.value)}
              required
            >
              <option value="">-- เลือกกิจกรรม --</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>
                  {a.activity_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            สมาชิก
            <select
              value={form.member_id || ""}
              onChange={e => set("member_id", e.target.value)}
              required
            >
              <option value="">-- เลือกสมาชิก --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {type === "leave" && (
        <>
          <label>
            ชื่อสมาชิก
            <select
              value={form.member_id || ""}
              onChange={e => set("member_id", e.target.value)}
              required
            >
              <option value="">-- เลือกสมาชิก --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            วันที่ลา
            <input
              type="date"
              value={form.leave_date || ""}
              onChange={e => set("leave_date", e.target.value)}
              required
            />
          </label>

          <label>
            เหตุผล
            <textarea
              value={form.reason || ""}
              onChange={e => set("reason", e.target.value)}
              required
            />
          </label>

          <p className="hint">
            เหตุผลการลาจะเห็นได้เฉพาะ Leader และ Co-Leader
          </p>
        </>
      )}

      <button className="primary full" onClick={onSave}>
        บันทึกข้อมูล
      </button>
    </div>
  );
}
