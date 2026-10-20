// 刪除人員之附件實體檔案清理：只處理已由資料庫交易寫入佇列的檔案。
// 傳回 true 表示尚有待清理工作；錯誤時保留佇列供後續附件上傳或刪除人員重試。
export async function cleanupDeletedMemberAttachments(admin: any): Promise<boolean> {
  try {
    for (let batch = 0; batch < 5; batch += 1) {
      const queued = await admin.from("attendance_attachment_cleanup_queue")
        .select("storage_path")
        .order("created_at", { ascending: true })
        .limit(100);
      if (queued.error) return true;

      const paths = (queued.data || []).map((row: any) => String(row.storage_path || "")).filter(Boolean);
      if (paths.length === 0) return false;

      const removed = await admin.storage.from("attendance-files").remove(paths);
      if (removed.error) return true;

      const cleared = await admin.from("attendance_attachment_cleanup_queue")
        .delete()
        .in("storage_path", paths);
      if (cleared.error) return true;
    }
    // 上限保護 Edge Function 時間；剩餘項目由後續呼叫接續處理。
    const remaining = await admin.from("attendance_attachment_cleanup_queue").select("storage_path").limit(1);
    return Boolean(remaining.error || remaining.data?.length);
  } catch {
    return true;
  }
}
