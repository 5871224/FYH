# CSS 原始碼分工

本資料夾是前端 CSS 的唯一正式原始來源。瀏覽器不直接載入這些模組；`scripts/build-css.js` 依固定順序合併成 `src/renderer/app.css`，`npm run web:publish` 再同步至 `docs/app.css`。

## 固定順序與責任

1. `foundation.css`：全域基礎與既有主要頁面結構；不要在此新增可共用元件的新規則。
2. `schedule.css`：班表導覽、工具列、凍結欄、水平捲動與班表專屬布局。
3. `components.css`：設計變數、共用按鈕、表單、頁籤、卡片、彈窗與一般表格；同類共用元件以此檔為唯一正式規則。
4. `responsive.css`：跨頁面的手機／平板響應式規則與主要頁面共用安全間距。
5. `pages.css`：無法歸入共用元件或班表結構的頁面專屬差異。

## 禁止補丁式 CSS

- 不直接修改產生檔 `src/renderer/app.css` 或 `docs/app.css`。
- 不新增 `fix.css`、`patch.css`、`refinement.css`、`final.css`、`override.css` 等補丁檔。
- 不以 `!important`、重複 selector、載入順序或檔尾覆寫當成修正舊規則的方法；應回到原本正式 selector 所屬模組直接修正。
- 不以 CSS 作為權限授權或權限 UI 修補工具。無權限元素應由 Renderer 在 canonical render 階段不建立，而不是先建立後以 `display:none`、visibility、`:has(...)` 或其他 selector 隱藏。
- 不為了把錯誤 DOM 結構「看起來正確」而用絕對定位、order、偽元素或其他視覺搬移取代正式 Renderer 修正。
- 共用尺寸、圓角、配色優先使用 `components.css` 中的正式變數；同一共用元件不得在多個頁面模組各自複製一份近似規則。

## 修改流程

1. 先找到規則真正所屬的正式 CSS 模組並直接修改。
2. 若問題源自 DOM、權限或 Renderer 結構，應修改 JavaScript／HTML 正式來源，不在 CSS 加補丁。
3. 執行 `npm run web:publish` 重新產生 CSS 與 `docs/`。
4. 至少確認 `npm run css:check`、`npm run renderer:check`；涉及共用樣式或重構時再執行 `npm run css:architecture` 或完整 `npm run ci:check`。
