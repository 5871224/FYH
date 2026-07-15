# 前端靜態站部署

前端是純靜態檔案（`docs/` 或 `src/renderer/`），不含後端。資料由瀏覽器直連 Supabase API。

## 發佈前

在 repo 根目錄建立 `.env`（參考 `.env.example`）：

```env
SUPABASE_URL=https://api.schedule.company.com
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
PUBLIC_SITE_ORIGIN=https://schedule.company.com
SUPABASE_DOCUMENT_ID=default
```

```bash
npm run web:config
npm run web:check
npm run web:publish
```

## 方案 A：GitHub Pages（現況）

1. Repo → Settings → Pages → Source：`main` 分支、`/docs`
2. Custom domain：`schedule.company.com`
3. DNS：`CNAME schedule -> YOUR_USER.github.io`（或 GitHub 提示的 target）
4. 可選：在 `docs/CNAME` 寫入自訂網域（GitHub 會自動管理）

每次改前端後 push `main`，確保已執行 `npm run web:publish` 更新 `docs/`。

## 方案 B：Cloudflare Pages

1. 建立 Pages 專案，連到本 repo
2. Build command：`npm run web:publish`
3. Output directory：`docs`
4. Environment variables（Build 時注入）：
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `PUBLIC_SITE_ORIGIN`
   - `SUPABASE_DOCUMENT_ID`
5. Custom domain：`schedule.company.com`

## Supabase Auth 設定

在自架或雲端 Supabase Dashboard → Authentication → URL Configuration：

| 欄位 | 值 |
|------|-----|
| Site URL | `https://schedule.company.com` |
| Redirect URLs | 同上；若有 `*.github.io` 測試站也加入 |

## 驗收

- 開啟 `https://schedule.company.com` 可看到登入畫面
- 工號登入後班表正常
- 瀏覽器 Network 請求指向 `https://api.schedule.company.com`
