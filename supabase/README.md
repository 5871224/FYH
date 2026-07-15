# Supabase 資料表說明

目前排班系統不再把主要資料存在 `schedule_documents.payload` JSON 裡。

主要資料改由各自資料表保存：

- 單位：`departments`
- 人員：`profiles` / `member_departments`
- 班別：`shift_types`
- 假別：`leave_types`
- 加班：`overtime_types`
- 班表：`schedule_months` / `schedule_entries`
- 主管設定請假：`leave_requests`
- 主管設定加班：`overtime_requests`

## 檔案

- [001_initial_schema.sql](/C:/Users/indar/Desktop/排班/supabase/001_initial_schema.sql)

新環境依序執行 SQL。既有環境請至少套用到最新的 migration。

若登入時出現 `relation "public.profiles" does not exist`，代表登入與人員主檔的基礎 schema 不完整。請到 Supabase **SQL Editor** 先執行 [`020_repair_profiles_schema.sql`](/supabase/020_repair_profiles_schema.sql)，再視需要重跑 [`017_normalized_scheduler_storage.sql`](/supabase/017_normalized_scheduler_storage.sql) 與 [`019_repair_schedule_months.sql`](/supabase/019_repair_schedule_months.sql)。

若登入時出現 `Could not find the function public.login_email_by_employee_code` 或 `profiles` 不存在，代表登入基礎 schema 未建立。請在 `.env` 設定 `DATABASE_URL`（Supabase Dashboard → Database → Connection string）後執行：

```bash
npm run web:repair-db
npm run web:schema
```

也可改到 Supabase **SQL Editor** 手動執行 [`020_repair_profiles_schema.sql`](/supabase/020_repair_profiles_schema.sql) 與 [`019_repair_schedule_months.sql`](/supabase/019_repair_schedule_months.sql)。

## 表的白話用途

### `departments`

單位主檔。

### `profiles`

人員主檔。  
一個登入帳號對應一個人員資料。

### `manager_departments`

舊版多單位主管關聯，目前 web 版沒有使用。

### `member_departments`

員工可支援哪些單位。  
因為你有「員工會跨單位支援」。

### `shift_types`

班別設定。  
這裡直接包含班別適用的單位，因為目前規則是一個班別只會有一個適用單位。

### `leave_types`

假別設定。

### `overtime_types`

加班別設定。

### `schedule_months`

某一個月份的班表主檔，例如 `2026-06`。

### `schedule_entries`

實際每天每個人的班表內容。  
這張是核心表。

### `leave_requests`

主管設定的請假紀錄。

### `overtime_requests`

主管設定的加班紀錄。

### `clock_locations`

舊版打卡地點，目前 web 版沒有使用。

### `attendance_logs`

舊版打卡紀錄，目前 web 版沒有使用。

### `scheduler_settings`

目前班表檢視月份、週起算、月起算、表格檢視等設定。

### `holidays`

國定假日設定。

## 權限目前設計

目前 RLS：

- 登入者可讀主要資料
- 主管可管理設定、人員、班表、請假與加班資料
- 公開網域部署請套用 `018_tighten_anon_read_policies.sql`，移除匿名讀取班表（登入仍保留 `login_email_by_employee_code`）

## 部署

- 內網自架 Supabase：`infra/self-host/README.md`
- API 公開通道：`infra/tunnel/README.md`
- 前端靜態站：`infra/deploy/README.md`
- 雲端遷移：`infra/migrate/README.md`

## 這份 SQL 的定位

目前的資料表是正式儲存來源。`schedule_documents` 只保留為舊 JSON 資料回填來源，不再是前端主要儲存目標。

舊資料回填在 `017_normalized_scheduler_storage.sql` 內處理。
