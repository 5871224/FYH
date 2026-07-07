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

## 重要說明

- 必須照順序執行，後面的函式會依賴前面新增的欄位或函式。
- `036_v2_synchronized_member_delete.sql` 會把 `set_employee.id` 連結到 `auth.users.id`，刪除 Auth 使用者時由資料庫交易同步級聯刪除人員資料。
- `037_v2_meal_subsidy_and_product_delete.sql` 新增公司補助設定、安全刪除品項及新版訂餐設定 RPC。
- 執行完成後，再部署 `scripts/deploy-v2-final.ps1` 所列的 Edge Functions。
- SQL Editor 顯示錯誤時不要繼續執行後續檔案，先保留完整錯誤訊息。
