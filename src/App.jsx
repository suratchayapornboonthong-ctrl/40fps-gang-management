
{tab === "attendance" && (
  <>
    <Toolbar
      title="เช็คชื่อกิจกรรม"
      desc="รายชื่อผู้เข้าร่วมและสถานะการเช็คชื่อ"
    />

    {activities.map(a => {
      const checked = attendance.filter(
        x => x.activity_id === a.id
      );

      const checkedIds = checked.map(x => x.member_id);

      const notChecked = active.filter(
        m => !checkedIds.includes(m.id)
      );

      return (
        <section className="panel" key={a.id}>
          <PanelTitle
            title={a.activity_name}
            subtitle={`${checked.length} / ${active.length} คนเช็คชื่อแล้ว`}
          />

          <div className="attendance-summary">
            <span>เช็คชื่อแล้ว <b>{checked.length}</b> คน</span>
            <span>ยังไม่เช็คชื่อ <b>{notChecked.length}</b> คน</span>
          </div>

          <h4>🟢 รายชื่อผู้เช็คชื่อแล้ว</h4>

          <div className="att-list">
            {checked.map(x => {
              const member = members.find(
                m => m.id === x.member_id
              );

              return (
                <div key={x.id}>
                  <CheckCircle2 size={17} />
                  <b>{member?.display_name || "ไม่พบรายชื่อสมาชิก"}</b>
                  <small>
                    {x.checked_at
                      ? new Date(x.checked_at).toLocaleString("th-TH")
                      : "ไม่ระบุเวลา"}
                  </small>
                </div>
              );
            })}

            {checked.length === 0 && (
              <p className="muted">ยังไม่มีสมาชิกเช็คชื่อ</p>
            )}
          </div>

          <h4>⚪ รายชื่อผู้ยังไม่เช็คชื่อ</h4>

          <div className="att-list">
            {notChecked.map(m => (
              <div key={m.id}>
                <span className="not-checked-dot" />
                {m.display_name}

                {admin && (
                  <button
                    className="small-action"
                    onClick={() => {
                      setForm({
                        activity_id: a.id,
                        member_id: m.id
                      });
                      setModal("attendance");
                    }}
                  >
                    เช็คชื่อ
                  </button>
                )}
              </div>
            ))}

            {notChecked.length === 0 && (
              <p className="muted">สมาชิกเช็คชื่อครบทุกคนแล้ว</p>
            )}
          </div>
        </section>
      );
    })}

    {activities.length === 0 && (
      <div className="panel">
        ยังไม่มีกิจกรรมในระบบ
      </div>
    )}
  </>
)}
