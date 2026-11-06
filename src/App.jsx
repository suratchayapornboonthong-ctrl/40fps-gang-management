
{tab === "attendance" && (
  <>
    
{tab === "attendance" && (
  <>
    <Toolbar
      title="เช็คชื่อกิจกรรม"
      desc="ติ๊กชื่อสมาชิกเพื่อบันทึกการเข้าร่วมกิจกรรม"
    />

    {activities.map(activity => {
      const checked = attendance.filter(
        item => item.activity_id === activity.id
      );

      const checkedIds = checked.map(item => item.member_id);

      return (
        <section className="panel attendance-panel" key={activity.id}>
          <PanelTitle
            title={activity.activity_name}
            subtitle={`${checked.length} / ${activeMembers.length} คน`}
          />

          <div className="attendance-summary">
            <b>🟢 มาแล้ว {checked.length} คน</b>
            <b>⚪ ยังไม่มา {activeMembers.length - checked.length} คน</b>
          </div>

          <div className="attendance-checkbox-list">
            {activeMembers.map(member => {
              const record = checked.find(
                item => item.member_id === member.id
              );

              return (
                <label
                  key={member.id}
                  className="attendance-checkbox"
                >
                  <input
                    type="checkbox"
                    checked={!!record}
                    disabled={!admin || busy}
                    onChange={async event => {
                      const isChecked = event.target.checked;

                      setBusy(true);
                      setErr("");

                      try {
                        if (isChecked) {
                          const { error } = await supabase
                            .from("attendance")
                            .insert({
                              activity_id: activity.id,
                              member_id: member.id
                            });

                          if (error) throw error;
                        } else {
                          const { error } = await supabase
                            .from("attendance")
                            .delete()
                            .eq("id", record.id);

                          if (error) throw error;
                        }

                        setNotice(
                          isChecked
                            ? `เช็คชื่อ ${member.display_name} แล้ว`
                            : `ยกเลิกเช็คชื่อ ${member.display_name} แล้ว`
                        );

                        await loadAll();
                      } catch (error) {
                        setErr(error.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />

                  <span className="attendance-member-name">
                    {member.display_name}
                  </span>

                  <span className={
                    record ? "attendance-done" : "attendance-waiting"
                  }>
                    {record ? "เช็คชื่อแล้ว" : "ยังไม่เช็คชื่อ"}
                  </span>
                </label>
              );
            })}
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
