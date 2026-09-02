## 需求摘要

<!-- 本專案預設直接提交 main；只有明確要求 PR 時使用本模板。說明本次要完成什麼，以及刻意不處理什麼。 -->

## 正式依據

- [ ] 已閱讀 `AGENTS.md`
- [ ] 已閱讀 `規格書.md` 與本次需求相關章節
- [ ] 若權限、架構、端點、欄位或功能位置有變更，已搜尋並同步全部 Markdown

## 允許修改範圍

```text
# 每行一個檔案或路徑規則，例如：
# src/renderer/**
# supabase/**
# 規格書.md
```

## 禁止修改範圍

```text
# 可留空；需要時每行一個檔案或路徑規則。
```

## Canonical／禁止補丁檢查

- [ ] 修改的是正式來源，不是 `app.js`、`app.css`、`docs/` 等產生檔
- [ ] 沒有新增 `fix`、`patch`、`override`、compatibility bridge 或後載入覆寫模組
- [ ] 沒有使用 DOM 掃描、`MutationObserver`、`prepend`／`appendChild`、timer fallback 在 render 後補插／搬移功能
- [ ] 權限 UI 在 canonical render 階段直接決定是否建立，沒有先 render 再靠 `hidden`、`style.display` 或 CSS 隱藏
- [ ] 沒有用泛用「主管／管理能力」取代 `settings`、`export`、`schedule_manage`、`department_settings`、`attendance_review`、`meal_admin` 等精確權限
- [ ] 若移除舊架構，舊路徑、舊 helper、舊文件與舊測試契約也在同一變更清除

## 權限選單檢查（若涉及班表功能選單）

- [ ] `settings` 只對應「設定」
- [ ] 目前群組 `schedule_manage` 只對應「排班」
- [ ] `export` 只對應「匯出」，且「列印班表」固定在此分類
- [ ] 無權限分類不建立，不依賴前一次 DOM 狀態
- [ ] 已測試重新登入、切換群組、離開再進頁面與重新整理

## 驗收與建置

- [ ] 已依需求逐項操作確認
- [ ] 已確認未影響禁止修改的頁面或功能
- [ ] 前端有變更時已執行 `npm run web:publish`
- [ ] 已執行相關單元／架構守門測試
- [ ] 重要變更已執行 `npm run ci:check`

## 風險與回滾

<!-- 說明主要風險，以及需要回滾時應還原哪些正式來源檔案或提交；不要以保留舊相容路徑作為回滾方案。 -->
