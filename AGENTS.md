# AI 開發代理人注意事項

本檔只記錄 AI 在本儲存庫執行工作時必須遵守的注意事項。所有功能需求、介面規則、資料模型與驗收標準，均以根目錄的 `規格書.txt` 為唯一正式來源，不得在本檔另行定義規格。

## 開始處理前

1. 先閱讀本檔，再閱讀 `規格書.txt` 中與任務相關的章節。
2. 修改前先確認目前程式與規格是否一致；有衝突時以 `規格書.txt` 為準，並在需要時同步修正程式。
3. 不新增獨立規格書、補充規格或臨時需求文件；規格異動直接整理進 `規格書.txt` 的既有樹狀章節。

主要目錄：

- 前端原始碼：`src/renderer/`
- GitHub Pages 發布檔案：`docs/`
- Supabase 現行資料庫結構與 RPC：`supabase/`
- 工具與檢查腳本：`scripts/`

## 編碼與語言

- 文字檔一律使用 UTF-8 編碼儲存。
- 中文文件與回覆使用繁體中文，除非使用者明確要求其他語言。
- 回覆保持精簡，只回報高層次進度，不逐項報告低階操作。

## 修改與發布規則

1. 若工作涉及網頁介面、互動、樣式或前端資料流程，必須執行：

```bash
npm run web:publish
```

2. GitHub Pages 使用 `docs/`，不是 `src/renderer/`；前端來源與發布檔案必須保持同步。
3. 若前端程式有修改，且使用者未明確要求不要提交，應提交並推送至 `main`。
4. 最終回覆必須說明：
   - `docs/` 是否已更新。
   - 是否已推送至 `main`。

## 修改時的檔案檢查

涉及自動排班基礎欄位時，至少檢查：

- `supabase/001_current_schema.sql`
- `supabase/functions/member-auth-admin/index.ts`
- `src/renderer/web-api.js`

涉及班表格資料儲存時，至少檢查：

- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- `src/renderer/web-api.js`
- `scripts/check-normalized-storage.js`

涉及 Supabase 資料庫結構、RPC 或部署方式時，至少檢查：

- `supabase/README.md`
- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- 相關 Edge Function 與驗證腳本

## 驗證原則

- 依修改範圍執行既有檢查，不得只確認檔案可儲存。
- 前端修改後確認 `src/renderer/` 與 `docs/` 一致。
- 資料庫或班表儲存修改後，至少考慮執行：

```bash
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
npm run v2:check
```

- 不得為了讓檢查通過而刪除仍有效的安全、權限、資料一致性或正式規格驗證。
