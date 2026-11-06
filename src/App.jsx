
const DEFAULT_PAYMENT_MEMBERS = [
  "Skyler Florence",
  "June awa",
  "Harper Steph",
  "Josave Overlove",
];

const [paymentSelected, setPaymentSelected] = React.useState(
  DEFAULT_PAYMENT_MEMBERS
);
const [paymentAmount, setPaymentAmount] = React.useState("50000");
const [paymentWeek, setPaymentWeek] = React.useState("2026-11-02");
const [paymentSaving, setPaymentSaving] = React.useState(false);

async function saveWeeklyPayments() {
  if (!admin) {
    alert("เฉพาะ Leader และ Co-Leader เท่านั้นที่บันทึกได้");
    return;
  }

  if (!paymentSelected.length || Number(paymentAmount) <= 0) {
    alert("กรุณาเลือกสมาชิกและระบุจำนวนเงิน");
    return;
  }

  setPaymentSaving(true);

  try {
    // ค้นหารหัสสมาชิกจากชื่อ
    const { data: memberRows, error: memberError } = await supabase
      .from("members")
      .select("id, display_name")
      .in("display_name", paymentSelected);

    if (memberError) throw memberError;

    if (!memberRows || memberRows.length !== paymentSelected.length) {
      throw new Error("ค้นหาสมาชิกไม่ครบ กรุณาตรวจสอบรายชื่อในตาราง members");
    }

    const memberIds = memberRows.map(member => member.id);

    // ตรวจสอบว่ามีรายการของสมาชิกในสัปดาห์นี้แล้วหรือไม่
    const { data: existingRows, error: existingError } = await supabase
      .from("weekly_payments")
      .select("member_id")
      .eq("week_start", paymentWeek)
      .in("member_id", memberIds);

    if (existingError) throw existingError;

    if (existingRows?.length) {
      const duplicateNames = memberRows
        .filter(member =>
          existingRows.some(row => row.member_id === member.id)
        )
        .map(member => member.display_name);

      throw new Error(
        "มีรายการของสัปดาห์นี้แล้ว: " + duplicateNames.join(", ") +
        " กรุณาตรวจสอบก่อนบันทึก"
      );
    }

    // สร้างรายการแยกคน
    const records = memberRows.map(member => ({
      member_id: member.id,
      week_start: paymentWeek,
      amount: Number(paymentAmount),
      recorded_by: profile.id,
    }));

    const { error: insertError } = await supabase
      .from("weekly_payments")
      .insert(records);

    if (insertError) throw insertError;

    alert("บันทึกการส่งเงินสำเร็จ " + records.length + " คน");
    await loadAll();

    setPaymentSelected([]);
  } catch (error) {
    alert("บันทึกไม่สำเร็จ: " + error.message);
  } finally {
    setPaymentSaving(false);
  }
}
