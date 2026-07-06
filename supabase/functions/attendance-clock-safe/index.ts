import { withSupabase } from "npm:@supabase/server@^1";

function safeRecord(record: any) {
  if (!record) return null;
  return {
    id: record.id,
    user_id: record.user_id,
    work_date: record.work_date,
    employee_code_snapshot: record.employee_code_snapshot || "",
    employee_name_snapshot: record.employee_name_snapshot || "",
    clock_in_at: record.clock_in_at || null,
    clock_in_department_id: record.clock_in_department_id || null,
    clock_in_department_name_snapshot: record.clock_in_department_name_snapshot || "",
    clock_in_source: record.clock_in_source || "",
    clock_out_at: record.clock_out_at || null,
    clock_out_department_id: record.clock_out_department_id || null,
    clock_out_department_name_snapshot: record.clock_out_department_name_snapshot || "",
    clock_out_source: record.clock_out_source || "",
    attendance_note: record.attendance_note || "",
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    if (req.method !== "POST") return Response.json({ message: "Method Not Allowed" }, { status: 405 });
    try {
      const url = Deno.env.get("SUPABASE_URL") || "";
      if (!url) throw new Error("伺服器缺少 Supabase 網址設定");
      const response = await fetch(`${url}/functions/v1/attendance-clock`, {
        method: "POST",
        headers: {
          apikey: req.headers.get("apikey") || "",
          Authorization: req.headers.get("Authorization") || "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(await req.json())
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String(result?.message || "打卡失敗");
        throw new Error(message.includes("目前 IP")
          ? "目前不在可打卡位置，請改用手機 GPS 或請管理員確認固定 IP 設定"
          : message);
      }
      return Response.json({ ...result, record: safeRecord(result?.record) });
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : "打卡失敗" }, { status: 400 });
    }
  })
};
