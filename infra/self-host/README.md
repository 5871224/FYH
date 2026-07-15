# 內網自架 Supabase

此資料夾提供在公司內網部署 Supabase 的步驟與腳本。目標是：

- Postgres 只在內網（不對外開 5432）
- 瀏覽器透過 HTTPS API（Kong / PostgREST / Auth / Edge Functions）存取
- 沿用本 repo 的 `supabase/*.sql` migration 與 `member-auth-admin` Edge Function

## 前置需求

- Linux VM 或實體主機（建議 4 vCPU / 8 GB RAM 以上）
- Docker + Docker Compose
- 可選：Supabase CLI（部署 Edge Function）

## 1. 安裝 Supabase Docker

官方文件：<https://supabase.com/docs/guides/self-hosting/docker>

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

編輯 `.env`，至少設定：

- `POSTGRES_PASSWORD`
- `JWT_SECRET`（至少 32 字元）
- `ANON_KEY` / `SERVICE_ROLE_KEY`（或使用官方產生器）
- `SITE_URL`：前端公開網域，例如 `https://schedule.company.com`
- `API_EXTERNAL_URL`：API 公開網域，例如 `https://api.schedule.company.com`
- `ADDITIONAL_REDIRECT_URLS`：若有 GitHub Pages 測試網域，一併加入

啟動：

```bash
docker compose up -d
```

Kong 預設在本機 `http://127.0.0.1:8000`。

## 2. 執行 migration

在 repo 根目錄：

```bash
# Linux / macOS
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres"
bash infra/self-host/apply-migrations.sh

# Windows PowerShell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres"
powershell -ExecutionPolicy Bypass -File infra/self-host/apply-migrations.ps1
```

腳本會依序執行 `supabase/001` 到最新 migration（含 `018_tighten_anon_read_policies.sql`）。

## 3. 部署 Edge Function

`member-auth-admin` 負責主管建立人員與重設密碼。

```bash
# 在 repo 根目錄，Supabase CLI 已 link 到自架專案時
supabase functions deploy member-auth-admin --project-ref local

# 或使用本 repo 腳本（需設定 SUPABASE_URL 與 SUPABASE_ACCESS_TOKEN）
bash infra/self-host/deploy-edge-function.sh
```

自架環境需在 `supabase/config.toml` 保留：

```toml
[functions.member-auth-admin]
verify_jwt = true
```

此 function 使用 `auth: "user"`，需有效 JWT 且角色為 manager。

## 4. 鎖定 Postgres 僅內網

1. Docker compose 不要把 `5432` publish 到公網 IP
2. 若需從管理機連線，只允許內網 CIDR
3. 所有公開流量走 Kong（8000）或 Cloudflare Tunnel，見 `infra/tunnel/`

## 5. 更新前端設定

在 repo 根目錄 `.env`：

```env
SUPABASE_URL=https://api.schedule.company.com
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_DOCUMENT_ID=default
PUBLIC_SITE_ORIGIN=https://schedule.company.com
```

產生設定並發佈：

```bash
npm run web:config
npm run web:check
npm run web:publish
```

## 6. 驗收

- `npm run web:check` 對新 API URL 成功
- 工號登入、載入班表、主管儲存可用
- 人員新增 / 重設密碼可用
- 外網 `psql` 直連 5432 失敗
- 未登入 REST 讀取班表失敗（RLS 018 已生效）
