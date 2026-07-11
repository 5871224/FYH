# Supabase 資料庫

本資料夾只保留目前正式需要的資料庫 SQL 與 Edge Functions。資料庫從零建立時，SQL 固定依下列順序執行：

1. `001_current_schema.sql`
2. `002_current_updates.sql`

Edge Functions 部署不會自動執行 SQL。兩份 SQL 均成功執行後，再於儲存庫根目錄執行：

```powershell
scripts/deploy-v2-final.ps1
```

SQL Editor 只要出現錯誤就應立即停止，不可跳過後續區段；請保留完整錯誤訊息再修正。

## 檔案用途

### `001_current_schema.sql`

建立系統基準結構，包含：

- 排班設定、人員、單位、班別、假別、加班與國定假日資料表。
- `schedule_entries` 正式班表資料。
- 打卡、打卡異動、加班申請與審核歷程。
- 訂餐商品、設定及訂單。
- 基礎索引、RLS、權限保護與核心 RPC。

### `002_current_updates.sql`

依原本 migration 順序整併所有基準結構後的正式更新，包含：

- 班表批次儲存 RPC。
- 訂餐設定、訂餐快照、公司補助與商品刪除保護。
- 有效任職、角色、最後管理員與敏感單位欄位保護。
- 打卡、管理員補登修改與完整稽核快照。
- 加班批次審核、刪除後重提與歷程索引。
- Auth 帳號與人員資料的交易式同步刪除。
- 人員排序、工號唯一性與舊打卡資料表移除。
- 私密資料存取強化及安全人員／單位名錄 RPC。

各區段保留原始檔名註解與原有交易邊界，方便追查歷史與錯誤位置。

## 目前資料模型

- `schedule_entries` 是班表格唯一正式來源；一格以 `member_id + work_date` 唯一識別。
- 班別、假別與班表加班共用同一列。
- 打卡加班申請與班表加班互相獨立。
- 班表批次寫入使用 `public.save_schedule_entries_bulk(entries jsonb)`。
- 打卡寫入使用 `public.save_attendance_clock(...)`，重複點擊不得覆寫第一次成功時間。
- 訂餐使用交易 RPC，保留第一次訂餐單位快照。
- 固定 IP、原始 GPS、精準度及距離不得透過一般 REST 查詢暴露。
- 人員與單位一般名錄使用安全 RPC，不直接開放私密主表欄位。

## 正式資料表

- `scheduler_settings`
- `set_departments`
- `set_employee`
- `set_shift`
- `set_leave`
- `set_overtime`
- `holidays`
- `schedule_entries`
- `attendance_records`
- `attendance_action_logs`
- `attendance_overtime_requests`
- `overtime_review_logs`
- `meal_products`
- `meal_settings`
- `meal_orders`

## 已淘汰物件

下列舊流程不得恢復：

- `leave_requests`
- `overtime_requests`
- `request_status`
- `request_type`
- `public.get_public_schedule_requests()`
- `clock_locations`
- `attendance_logs`

## 維護規則

1. 不再新增零散的一次性 SQL 或 SQL 套用順序文件。
2. 新增資料庫異動時，將具備冪等性的完整區段附加至 `002_current_updates.sql`，並更新本 README。
3. 若修改基礎資料表或核心 RPC，也要同步檢查 `001_current_schema.sql` 是否需更新，確保全新環境可正常建立。
4. 涉及班表儲存時，同步檢查 `src/renderer/web-api.js` 與 `scripts/check-normalized-storage.js`。
5. 涉及前端時，執行 `npm run web:publish`，保持 `src/renderer/` 與 `docs/` 一致。
6. 部署前至少執行：

```bash
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
npm run v2:check
```
