from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

README = """# 福圓號排班系統

福圓號排班系統是手機優先的瀏覽器應用程式，涵蓋排班、打卡、加班、訂餐、個人記錄與管理功能。前端以 GitHub Pages 發布，登入、資料庫、RPC 與伺服器端 API 由 Supabase 提供。

## 文件分工

- `README.md`：專案入口、目錄、開發指令與部署方式。
- `規格書.txt`：唯一正式功能、介面、資料模型、安全與驗收規格。
- `AGENTS.md`：AI 開發代理人在本儲存庫工作時必須遵守的注意事項。

README 不重複保存詳細功能規格；需求與實作有差異時，以 `規格書.txt` 為準。

## 現行架構

```text
瀏覽器前端（GitHub Pages）
  ↓ 登入憑證與使用者操作
Supabase Edge Functions／REST／RPC
  ↓ 身分、角色、時間、安全及交易驗證
Supabase PostgreSQL
```

- GitHub Pages 只託管 `docs/` 內的靜態檔案。
- 前端原始碼位於 `src/renderer/`。
- Supabase Auth 負責登入身分。
- PostgreSQL、RLS 與 RPC 負責正式資料、權限與交易一致性。
- `supabase/functions/` 保存 Edge Function 原始碼；正式部署清單以 `scripts/deploy-v2-final.ps1` 為準，不以資料夾是否存在判定。

## 專案結構

- `src/renderer/`：前端原始碼。
- `docs/`：GitHub Pages 正式發布內容。
- `supabase/001_current_schema.sql`：全新資料庫的基準結構。
- `supabase/002_current_updates.sql`：基準結構後的現行正式更新。
- `supabase/functions/`：Supabase Edge Functions 原始碼。
- `scripts/`：檢查、同步與部署腳本。
- `.github/workflows/`：GitHub Pages 與自動化流程。

## 本機執行與常用指令

需要 Node.js。可在儲存庫根目錄執行：

```bash
npm run web
npm run web:check
npm run web:publish
npm run v2:check
```

- `npm run web`：啟動本機靜態預覽伺服器。
- `npm run web:check`：檢查公開 Supabase 設定。
- `npm run web:publish`：將 `src/renderer/` 同步到 `docs/`，並更新靜態資源版本參數。
- `npm run v2:check`：執行 V2 結構與發布內容對齊檢查。

## 前端發布

1. 修改前端原始碼時，只修改 `src/renderer/` 的正式來源。
2. 完成後執行：

```bash
npm run web:publish
```

3. 確認 `src/renderer/` 與 `docs/` 同步後提交至 `main`。
4. GitHub Pages 工作流程 `.github/workflows/deploy-pages.yml` 會發布 `docs/`。

GitHub Pages 是靜態網站，不需要在 Pages 工作流程執行 npm 建置。

## Supabase 資料庫建置

全新環境固定依下列順序，在 Supabase SQL Editor 完整執行：

1. `supabase/001_current_schema.sql`
2. `supabase/002_current_updates.sql`

`001_current_schema.sql` 建立基準資料表、索引、RLS、權限與核心 RPC；`002_current_updates.sql` 整併基準結構後所有仍有效的正式更新。

SQL 執行期間只要出現錯誤就應立即停止，不可略過錯誤繼續執行。Edge Function 部署不會自動套用 SQL。

## Supabase Edge Functions 部署

完成兩份 SQL 後，在 Windows PowerShell 由儲存庫根目錄執行：

```powershell
.\\scripts\\deploy-v2-final.ps1
```

腳本透過 `npx supabase@latest functions deploy` 逐一部署目前正式使用的 Edge Functions。部署名單以該腳本內的 `$functions` 陣列為唯一準據；不要直接把 `supabase/functions/` 下所有資料夾都視為正式端點。

## 驗證

依修改範圍執行下列檢查：

```bash
npm run web:check
node --check src/renderer/renderer.js
node --check src/renderer/web-api.js
node --check src/renderer/v2-auto-fill-schedule.js
node scripts/check-normalized-storage.js
node scripts/check-expansion-acceptance.js
node scripts/check-settings-lists.js
npm run v2:check
```

前端有修改時，最後仍須執行 `npm run web:publish` 並確認 `docs/` 已更新。
"""

AGENTS = """# AI 開發代理人注意事項

本檔只記錄 AI 在本儲存庫執行工作時必須遵守的注意事項。所有功能需求、介面規則、資料模型與驗收標準，均以根目錄的 `規格書.txt` 為唯一正式來源，不得在本檔或 README 另行定義規格。

## 文件分工與開始處理前

1. 先閱讀本檔，再閱讀 `規格書.txt` 中與任務相關的章節。
2. 需要了解目錄、指令或部署方式時，再閱讀根目錄 `README.md`。
3. 修改前先確認目前程式與規格是否一致；有衝突時以 `規格書.txt` 為準，並在需要時同步修正程式。
4. 不新增獨立規格書、補充規格、SQL 套用順序文件或臨時需求文件；規格異動直接整理進 `規格書.txt` 的既有樹狀章節。
5. README 只保留專案入口與操作方式，不複製詳細功能規格或 AI 工作規則。

主要目錄：

- 前端原始碼：`src/renderer/`
- GitHub Pages 發布檔案：`docs/`
- Supabase 現行資料庫結構與 RPC：`supabase/`
- 工具、檢查與部署腳本：`scripts/`

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

## Supabase 維護規則

1. 現行正式 SQL 只有：
   - `supabase/001_current_schema.sql`
   - `supabase/002_current_updates.sql`
2. 全新資料庫固定先執行 `001_current_schema.sql`，再執行 `002_current_updates.sql`。
3. 新增資料庫異動時，將具備冪等性的完整區段附加至 `002_current_updates.sql`；若影響全新環境，也必須同步更新 `001_current_schema.sql`。
4. 不新增零散的一次性 SQL、migration 子檔或額外 SQL 順序文件。
5. Edge Function 正式部署清單以 `scripts/deploy-v2-final.ps1` 的 `$functions` 陣列為準；不得因 `supabase/functions/` 中存在資料夾，就自行判定該函式仍在正式使用。
6. 新增、移除或改名正式 Edge Function 時，必須同步更新部署腳本、根 README 與規格書第七章的現行後端功能清單。
7. SQL Editor 出現錯誤時立即停止，不可跳過後續區段。

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

- 根目錄 `README.md`
- `supabase/001_current_schema.sql`
- `supabase/002_current_updates.sql`
- `scripts/deploy-v2-final.ps1`
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
"""

SQL_SPEC = """### 5.6.1 現行 SQL 建置檔

1. 全新資料庫固定依序執行：
   - `supabase/001_current_schema.sql`
   - `supabase/002_current_updates.sql`
2. `001_current_schema.sql` 建立目前系統的基準資料表、索引、RLS、權限保護與核心 RPC。
3. `002_current_updates.sql` 依原始 migration 順序整併基準結構後所有仍有效的正式更新，包含班表批次儲存、訂餐、任職與角色保護、打卡與稽核、加班審核、帳號刪除、人員排序、唯一限制及私密資料存取強化。
4. Edge Function 部署不會自動執行 SQL；兩份 SQL 必須先成功套用。
5. SQL Editor 只要出現錯誤即停止，不可略過錯誤繼續執行。

### 5.6.2 已淘汰資料物件

下列舊物件不再是正式資料來源，不得在新功能中恢復使用：

- `leave_requests`
- `overtime_requests`
- `request_status`
- `request_type`
- `public.get_public_schedule_requests()`
- `clock_locations`
- `attendance_logs`

### 5.6.3 一般名錄與敏感欄位

1. 人員與單位的一般名錄資料應透過受控安全 RPC 或後端 API 取得，不直接向瀏覽器開放私密主表的完整欄位。
2. 固定對外 IP、原始 GPS、定位精準度、距離、管理稽核資料及其他敏感欄位，不得透過一般 REST 查詢提供給員工或主管。
3. Edge Function 或正式後端回傳資料前必須依角色過濾欄位，只提供執行目前功能所需的最少資料。
"""

FUNCTION_SECTION = """## 7.4 現行後端功能清單

正式 Edge Function 部署清單以 `scripts/deploy-v2-final.ps1` 的 `$functions` 陣列為準。`supabase/functions/` 中未列入該腳本的資料夾，不視為目前正式部署端點。

| 現行 Edge Function | 主要責任 | 未來後端對應 |
|---|---|---|
| `member-auth-admin` | 建立、修改帳號與重設密碼 | 帳號管理 API＋身分服務介接 |
| `catalog-admin` | 班別、假別與班表加班設定的受保護管理操作 | 設定管理 API＋目錄 Service |
| `report-records` | 共用個人記錄、管理查詢與報表資料整合 | 記錄／報表查詢 API |
| `attendance-clock` | 今日打卡狀態、GPS／IP 驗證、上下班打卡 | 打卡 Controller＋位置驗證 Service |
| `attendance-clock-safe` | 代理打卡請求並過濾敏感回傳欄位 | 安全 API Gateway／回應過濾層 |
| `meal-order` | 今日訂餐、商品設定讀取與訂單保存 | 訂餐 API＋訂單 Service |
| `attendance-overtime-employee` | 員工加班資格、狀態、送出與刪除 | 員工加班 API＋加班 Service |
| `attendance-overtime-admin-list` | 管理員加班審核清單 | 管理端加班查詢 API |
| `attendance-overtime-admin-action` | 調整、核准、退回、批次處理與代為申請 | 管理端命令 API＋交易 Service |
| `attendance-admin-list-v2` | 管理員打卡資料與異常查詢 | 打卡管理查詢 API |
| `attendance-admin-action-v2` | 補登、修改、清除與異動歷程 | 打卡管理命令 API＋稽核 Service |
| `department-attendance-v2` | 管理員讀取及維護單位打卡敏感設定 | 單位打卡設定管理 API |
| `member-delete-v2` | 帳號刪除、自刪驗證及最後管理員保護 | 帳號刪除 API＋交易 Service |
| `member-order-v2` | 人員排序讀取與保存 | 排序設定 API |
| `personal-records-v2` | 個人班表、打卡、加班與訂餐記錄 | 個人記錄彙整 API |
| `meal-report-v2` | 訂餐統計與管理查詢 | 訂餐報表 API |
| `meal-cancel-v2` | 整張取消今日訂餐 | 訂單取消 API＋交易 Service |

新增、移除或改名正式 Edge Function 時，部署腳本、本節與根目錄 README 必須同步更新。

"""


def update_spec(text: str) -> str:
    if "### 5.6.1 現行 SQL 建置檔" not in text:
        marker = "\n## 5.7 資料表與欄位中文說明"
        if marker not in text:
            raise RuntimeError("找不到規格書 5.7 插入位置")
        text = text.replace(marker, "\n\n" + SQL_SPEC.rstrip() + "\n" + marker, 1)

    start = text.find("## 7.4 現行後端功能清單")
    end = text.find("## 7.5 遷移至其他後端平台的對應原則")
    if start < 0 or end < 0 or end <= start:
        raise RuntimeError("找不到規格書第 7.4 節範圍")
    text = text[:start] + FUNCTION_SECTION + text[end:]
    return text


def main() -> None:
    (ROOT / "README.md").write_text(README, encoding="utf-8")
    (ROOT / "AGENTS.md").write_text(AGENTS, encoding="utf-8")

    spec_path = ROOT / "規格書.txt"
    spec = spec_path.read_text(encoding="utf-8-sig")
    spec_path.write_text(update_spec(spec), encoding="utf-8-sig")

    remove_paths = [
        "supabase/README.md",
        "readme_merge_audit.txt",
        "scripts/audit_readme_merge_once.py",
        ".github/workflows/audit-readme-merge-once.yml",
        "scripts/merge_readmes_once.py",
        ".github/workflows/merge-readmes-once.yml",
    ]
    for rel in remove_paths:
        path = ROOT / rel
        if path.exists():
            path.unlink()


if __name__ == "__main__":
    main()
