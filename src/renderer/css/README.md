# CSS 原始碼分工

本資料夾是前端 CSS 的唯一原始來源。瀏覽器不直接載入這些模組；
`scripts/build-css.js` 會依固定順序合併成 `src/renderer/app.css`，
`npm run web:publish` 再同步為 `docs/app.css`。

## 固定順序與責任

1. `foundation.css`：全域基礎、主要頁面結構及班表既有結構。共用按鈕、表單與卡片的新規則不得再加入此檔。
2. `schedule.css`：班表導覽、工具列、凍結欄及水平捲動框架的專屬規則。
3. `components.css`：設計變數、共用按鈕、表單、頁籤、卡片、彈窗與一般表格；同類共用元件以此檔為唯一正式規則。
4. `responsive.css`：跨頁面的手機與平板響應式規則，以及五個主要頁面的統一安全間距。
5. `pages.css`：登入、打卡等頁面無法共用的最終局部規則。

## 維護規則

- 不直接修改產生檔 `src/renderer/app.css` 或 `docs/app.css`。
- 不新增 `fix.css`、`refinement.css`、`final.css` 等補丁檔；規則應回到正確模組。
- 共用尺寸、圓角、配色優先使用 `components.css` 中的 CSS 變數。
- 修改後執行 `npm run web:publish`，並確認 `npm run css:check` 與 `npm run renderer:check` 通過。
