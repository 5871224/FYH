# 福圓號 V2 SQL 套用順序

Edge Functions 部署不會自動執行 SQL。請在 Supabase SQL Editor 依序執行：

1. `001_current_schema.sql`
2. `024_schedule_entries_rpc.sql`
3. `026_meal_admin_settings_rpc.sql`
4. `027_v2_security.sql`
5. `028_v2_attendance_clock.sql`
6. `029_v2_attendance_admin.sql`
7. `030_v2_meal_snapshot.sql`
8. `031_v2_role_department_protection.sql`
9. `032_v2_overtime_batch.sql`
10. `033_v2_employee_visibility.sql`
11. `034_v2_overtime_reapply.sql`
12. `035_v2_last_admin.sql`
13. `036_v2_synchronized_member_delete.sql`
14. `037_v2_meal_subsidy_and_product_delete.sql`
15. `038_v2_employee_sort_order.sql`
16. `039_remove_legacy_attendance_tables.sql`
17. `040_enforce_employee_code_uniqueness.sql`
18. `041_transactional_member_account_delete.sql`
19. `042_fix_transactional_member_account_delete_order.sql`

## 重要說明

- 必須照順序執行，後面的函式會依賴前面新增的欄位或函式。
- `038_v2_employee_sort_order.sql` 新增人員排序欄位。
- `039_remove_legacy_attendance_tables.sql` 移除未使用且無資料的 `attendance_logs`、`clock_locations`。
- `040_enforce_employee_code_uniqueness.sql` 以去除前後空白及不分英文字母大小寫的方式，強制工號唯一。
- `041_transactional_member_account_delete.sql` 以資料庫交易同步處理人員資料與 Auth 帳號刪除；已有歷史資料時改為停用帳號。
- `042_fix_transactional_member_account_delete_order.sql` 修正無歷史人員的刪除順序，先刪除 Auth 帳號，再由外鍵連動刪除人員資料，避免觸發直接刪除保護。
- `043_harden_private_data_access.sql` 移除匿名與逾期帳號的資料讀取旁路，並以安全 RPC 提供人員及單位名錄。
- 執行完成後，再部署 `scripts/deploy-v2-final.ps1` 所列的 Edge Functions。
- SQL Editor 顯示錯誤時不要繼續執行後續檔案，先保留完整錯誤訊息。
