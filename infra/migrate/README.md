# 雲端 Supabase 遷移到內網自架

## 匯出（雲端）

在可連到雲端 Postgres 的管理機執行：

```bash
export CLOUD_DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
bash infra/migrate/export-cloud.sh
```

產出：`infra/migrate/backups/workforce-YYYYMMDD-HHMMSS.dump`

## 匯入（內網）

```bash
export DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/postgres"
bash infra/migrate/import-selfhost.sh infra/migrate/backups/workforce-YYYYMMDD-HHMMSS.dump
```

匯入後請：

1. 在自架 Supabase 重新簽發 publishable / secret keys
2. 更新 `.env` 的 `SUPABASE_URL` 與 `SUPABASE_PUBLISHABLE_KEY`
3. 執行 `npm run web:config && npm run web:check && npm run web:publish`
4. 部署 `member-auth-admin` Edge Function

## 驗證筆數

```bash
psql "$DATABASE_URL" -f infra/migrate/verify-counts.sql
```

比對雲端與內網的 `profiles`、`schedule_entries`、`schedule_months` 等表筆數。

## 注意

- dump 含 `auth` schema，restore 後使用者密碼與 JWT secret 需與自架 `.env` 的 `JWT_SECRET` 一致，否則既有 session 會失效（使用者重新登入即可）
- 若只遷移 schema 不含資料，改用 `export-cloud.sh --schema-only`
