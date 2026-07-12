# CSS 重複與覆蓋稽核

- CSS 規則總數：836
- 同一情境重複選擇器：33 組
- 完全相同可安全合併：0 組
- 宣告不同、需人工判斷：33 組
- 同一規則內重複屬性：7 筆

## 完全相同的重複規則

無。

## 同選擇器但宣告不同

### `:root` — root
- **foundation.css:1**：`color-scheme: light; --bg: #efe9dd; --panel: #fffdf8; --panel-strong: #f8f3e7; --line: #ddd4c6; --text: #2b241c; --muted: #76695b; --accent: #9c6b2f; --accent-strong: #7f5422; --accent-soft: #efe2c8; --danger: #ae3c33; --today: #f8ead1; --week-alt: #ede1cc; --shadow: 0 16px 34px rgba(72, 52, 31, 0.08); --dept-col-width: 72px; --person-col-width: 92px; --stats-col-width: 86px; --day-col-width: 44px; --schedule-frozen-width: 250px; --schedule-radius: 18px; --schedule-grid-line: #ebe3d8; --schedule-header-bg: #fbf8f1`
- **components.css:1**：`--ui-control-height: 40px; --ui-control-height-compact: 34px; --ui-control-radius: 12px; --ui-icon-radius: 10px; --ui-table-radius: 14px; --ui-section-radius: 18px; --ui-page-radius: 24px; --ui-surface: #fffdf8; --ui-surface-raised: #ffffff; --ui-surface-muted: #fbf8f1; --ui-surface-hover: #f8f1e5; --ui-border: var(--line, #ddd4c6); --ui-text: var(--text, #2b241c); --ui-muted: var(--muted, #76695b); --ui-accent: var(--accent, #9c6b2f); --ui-accent-strong: var(--accent-strong, #7f5422); --ui-danger: var(--danger, #ae3c33); --ui-focus-ring: 0 0 0 3px rgba(156, 107, 47, 0.16); --ui-control-shadow: 0 1px 2px rgba(72, 52, 31, 0.05); --ui-row-hover: #fdf8ef; --schedule-nav-control-height: var(--ui-control-height); --settings-drag-column-width: 30px; --settings-action-column-width: 72px`

### `.toolbar-floating-card.toolbar-floating-card-collapsed .toolbar-top-row` — root
- **foundation.css:713**：`position: static; margin-bottom: 0; gap: 0`
- **schedule.css:39**：`position: static; display: flex; align-items: center; width: auto; min-height: 0; margin: 0; gap: 0`

### `.toolbar-title-row` — root
- **foundation.css:768**：`justify-content: flex-start`
- **foundation.css:848**：`display: flex; align-items: center; gap: 8px; margin-bottom: 10px`

### `.calendar-nav` — root
- **foundation.css:1075**：`width: 100%; max-width: 100%; flex-wrap: nowrap; justify-content: space-between; align-self: flex-start; gap: 12px; margin-bottom: 14px`
- **schedule.css:3**：`position: relative`

### `.calendar-nav-left select` — root
- **foundation.css:1116**：`min-width: 112px; max-width: 180px; flex: 0 0 124px; border: 1px solid var(--line); border-radius: 999px; padding: 8px 30px 8px 12px; background: #fff`
- **schedule.css:94**：`padding-top: 0; padding-bottom: 0`

### `.auth-footer` — root
- **foundation.css:1812**：`margin-top: 4px`
- **pages.css:28**：`display: block; width: 100%`

### `.modal` — root
- **foundation.css:1816**：`width: min(420px, 100%); max-height: calc(100vh - 48px); border-radius: 26px; padding: 20px; display: flex; flex-direction: column`
- **components.css:235**：`overflow: hidden`

### `.department-settings-modal .modal-body` — root
- **foundation.css:1860**：`flex: 1; min-height: 0; overflow-y: scroll; scrollbar-gutter: stable; scrollbar-color: #cdbb9f #fbf8f1; scrollbar-width: thin`
- **components.css:827**：`overflow: hidden`

### `.modal-header` — root
- **foundation.css:1900**：`justify-content: space-between; margin-bottom: 14px; gap: 16px`
- **components.css:239**：`min-height: 42px; padding-bottom: 12px; border-bottom: 1px solid rgba(156, 107, 47, 0.12)`

### `.modal-body` — root
- **foundation.css:1942**：`overflow: auto; display: flex; flex-direction: column; gap: 12px`
- **components.css:245**：`padding: 2px`

### `.modal-footer` — root
- **foundation.css:1956**：`justify-content: flex-end; gap: 10px; margin-top: 18px`
- **components.css:249**：`padding-top: 14px; border-top: 1px solid rgba(156, 107, 47, 0.12)`

### `.compact-btn` — root
- **foundation.css:2144**：`padding: 8px 12px`
- **components.css:164**：`min-height: var(--ui-control-height-compact) !important; padding: 0 11px !important; border-radius: 10px !important; font-size: 13px !important`

### `.member-table-wrap, .settings-table-wrap, .department-settings-table-wrap` — root
- **foundation.css:2494**：`position: relative; border: 1px solid var(--line); border-radius: 18px; background: #fff`
- **components.css:338**：`border-radius: var(--ui-table-radius)`

### `.member-table-scroll, .settings-table-scroll` — root
- **foundation.css:2510**：`height: 100%; min-height: 0; border-radius: 17px; overflow: auto`
- **components.css:344**：`border-radius: calc(var(--ui-table-radius) - 1px)`

### `.settings-table-head, .member-table-head, .department-settings-head` — root
- **foundation.css:2597**：`position: sticky; top: 0; z-index: 2; border-radius: 18px 18px 0 0; background: #fbf8f1; color: var(--muted); font-size: 12px; font-weight: 700; text-align: center`
- **components.css:331**：`border-radius: var(--ui-table-radius) var(--ui-table-radius) 0 0; background: var(--ui-surface-muted)`

### `.settings-icon-btn` — root
- **foundation.css:2676**：`width: 30px; height: 30px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--accent-strong); display: inline-flex; align-items: center; justify-content: center; padding: 0; transition: 0.15s ease`
- **components.css:177**：`width: 34px; height: 34px`

### `.department-settings-table-department .department-settings-row` — root
- **foundation.css:2795**：`grid-template-columns: minmax(76px, 0.55fr) minmax(220px, 2.1fr) minmax(74px, 0.45fr)`
- **components.css:467**：`grid-template-columns: 30px minmax(76px, .55fr) minmax(220px, 2.1fr) minmax(74px, .45fr)`

### `.app-shell` — @media (max-width: 960px)
- **foundation.css:2**：`padding: 12px; padding-bottom: 280px; gap: 10px`
- **responsive.css:2**：`padding-top: 12px`

### `.toolbar-grid` — @media (max-width: 640px)
- **foundation.css:2**：`grid-template-columns: 1fr`
- **components.css:274**：`gap: var(--ui-mobile-gap-tight); max-height: calc(min(42dvh, 300px) - 12px)`

### `.calendar-nav` — @media (max-width: 640px)
- **foundation.css:6**：`flex-wrap: wrap; align-items: stretch; gap: 8px`
- **components.css:251**：`gap: var(--ui-mobile-gap-tight); margin-bottom: 7px`

### `.member-settings-filters` — @media (max-width: 640px)
- **foundation.css:62**：`grid-template-columns: 1fr`
- **components.css:58**：`flex: 0 0 auto; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px`
- **components.css:196**：`gap: 4px 5px`

### `.app-shell` — @media (max-width: 640px)
- **foundation.css:66**：`padding-bottom: 260px`
- **components.css:20**：`padding-top: var(--ui-mobile-page-gutter); padding-right: var(--ui-mobile-page-gutter); padding-left: var(--ui-mobile-page-gutter); gap: var(--ui-mobile-gap)`

### `.toolbar-floating-card` — @media (max-width: 640px)
- **foundation.css:70**：`max-height: min(42vh, 300px)`
- **components.css:261**：`right: var(--ui-mobile-page-gutter); bottom: var(--ui-mobile-page-gutter); left: var(--ui-mobile-page-gutter); padding: 6px`

### `:root` — @media (max-width: 640px)
- **components.css:2**：`--ui-control-height: 42px`
- **components.css:2**：`--ui-mobile-page-gutter: 4px; --ui-mobile-card-padding: 10px; --ui-mobile-section-padding: 9px; --ui-mobile-gap: 6px; --ui-mobile-gap-tight: 4px`

### `.modal-overlay, .auth-overlay` — @media (max-width: 640px)
- **components.css:16**：`padding: 12px`
- **components.css:54**：`padding: var(--ui-mobile-page-gutter)`

### `.member-settings-modal .member-table-row` — root
- **components.css:454**：`grid-template-columns: var(--settings-drag-column-width) 104px minmax(86px, .9fr) minmax(170px, 1.45fr) 64px 108px 84px 78px var(--settings-action-column-width)`
- **components.css:740**：`width: 100%`

### `.department-settings-modal .department-settings-table-wrap` — root
- **components.css:831**：`flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto`
- **pages.css:42**：`width: 100%; overflow-x: hidden; overflow-y: auto`

### `.department-settings-modal .department-settings-table-department .department-settings-row` — root
- **components.css:838**：`min-width: 720px; grid-template-columns: 30px 120px minmax(390px, 1fr) 90px`
- **pages.css:53**：`display: grid !important; grid-template-columns: var(--settings-drag-column-width) minmax(72px, .62fr) minmax(150px, 1.8fr) 104px 62px 68px var(--settings-action-column-width) !important; align-items: center; column-gap: 8px; box-sizing: border-box; width: 100%; min-width: 0; padding-right: 10px; padding-left: 10px`

### `.department-settings-modal .department-settings-table-department .settings-order-drag-col` — root
- **components.css:936**：`grid-column: 1; order: 0`
- **pages.css:78**：`grid-column: 1 !important`

### `.department-settings-modal .department-settings-table-department .member-table-actions` — root
- **components.css:951**：`grid-column: 4; order: 0`
- **pages.css:122**：`grid-column: 7 !important; grid-row: 1 !important; display: flex !important; flex-direction: row !important; flex-wrap: nowrap !important; align-items: center; justify-content: center; gap: 6px; width: 100%; white-space: nowrap`

### `.home-card, .clock-card, .meal-card, .records-card, .calendar-card` — @media (max-width: 640px)
- **components.css:34**：`padding: var(--ui-mobile-card-padding)`
- **responsive.css:15**：`width: 100%; max-width: none; min-height: 0 !important; margin: 0; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important`

### `.meal-report-fields` — root
- **components.css:1423**：`grid-template-columns: minmax(140px, 160px) minmax(140px, 160px) minmax(130px, 1fr) minmax(130px, 1fr) minmax(110px, 130px)`
- **components.css:1530**：`grid-template-columns: minmax(140px, 160px) minmax(140px, 160px) minmax(130px, 1fr) minmax(130px, 1fr) minmax(110px, 130px) minmax(130px, 150px)`

### `.meal-report-fields` — @media (max-width: 900px)
- **components.css:6**：`grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "from to" "department department" "member view"`
- **components.css:2**：`grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "from to" "department member" "view export"`

## 同一規則內重複屬性

- **foundation.css:1127** `.table-top-scrollbar`：`position` → `-webkit-sticky`、`sticky`
- **foundation.css:1148** `.table-sticky-header`：`position` → `-webkit-sticky`、`sticky`
- **foundation.css:1166** `.table-sticky-header-left`：`position` → `-webkit-sticky`、`sticky`
- **foundation.css:1223** `.table-sticky-cell-dept`：`position` → `-webkit-sticky`、`sticky`
- **foundation.css:1233** `.table-sticky-cell-person`：`position` → `-webkit-sticky`、`sticky`
- **foundation.css:1243** `.table-sticky-cell-stats`：`position` → `-webkit-sticky`、`sticky`
- **foundation.css:1451** `.dept-col, .person-col, .stats-col`：`position` → `-webkit-sticky`、`sticky`
