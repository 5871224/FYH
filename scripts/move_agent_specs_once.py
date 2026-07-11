from pathlib import Path
import re

ROOT = Path('.')
SPEC_PATH = ROOT / '規格書.txt'
AGENTS_PATH = ROOT / 'AGENTS.md'
WORKFLOW_PATH = ROOT / '.github/workflows/move-agent-specs-once.yml'
SCRIPT_PATH = ROOT / 'scripts/move_agent_specs_once.py'

spec = SPEC_PATH.read_text(encoding='utf-8-sig')

new_section = '''### 3.3.8 自動排班與例休檢查

自動排班採「先預覽、再套用」：

1. 只處理人員在職期間內的日期。
2. 每位人員每天最多只能安排一個班別。
3. 優先安排人員所屬單位，其次依可支援單位設定順序安排其他單位。
4. 排入班別時依人員可排班班別設定順序選擇有效班別。
5. 依各班別的需求人數補足人力。
6. 手動設定的班別與假別視為鎖定資料，自動排班不得覆寫。
7. 使用固定休假星期與每月休假天數；每月休假天數是固定目標。
8. 已排入的例假與休息日均計入每月休假天數。
9. 若需求人數無法補足，保留空白班表格，不強制安排不符合條件的人員。
10. 同一單位同一天有多個班別缺人時，依班別設定順序補足。
11. 產生結果時檢查例假、休息日與連續上班限制。
12. 預覽只保存在前端，不立即寫入正式班表。
13. 按「套用預覽」後才批次保存至 `schedule_entries`。
14. 可取消預覽，取消時不得修改正式班表。

例休檢查規則：

1. 每 7 天至少有 1 天例假。
2. 每 7 天至少有 1 天休息日。
3. 連續上班不得超過 6 天。
4. 連續上班檢查採滑動區間計算，並包含上一個月延續下來的上班天數。
5. 例休檢查依目前八週範圍，顯示每位人員的缺漏與待確認項目。

權限：

- **員工：** 可查看套用後的完整班表。
- **主管：** 具備員工全部能力，並可執行預覽、套用、取消與例休檢查。
- **管理員：** 具備主管全部能力。
'''

pattern = r'### 3\.3\.8 自動排班與例休檢查\n.*?(?=\n### 3\.3\.9 排序共通規格)'
updated_spec, count = re.subn(pattern, new_section.rstrip(), spec, count=1, flags=re.S)
if count != 1:
    raise RuntimeError(f'無法定位規格書 3.3.8 節，符合數量：{count}')

agents = '''# AI 開發代理人注意事項

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
'''

SPEC_PATH.write_text(updated_spec, encoding='utf-8-sig')
AGENTS_PATH.write_text(agents, encoding='utf-8')

# 基本驗證
final_spec = SPEC_PATH.read_text(encoding='utf-8-sig')
final_agents = AGENTS_PATH.read_text(encoding='utf-8')
assert '優先安排人員所屬單位，其次依可支援單位設定順序安排其他單位' in final_spec
assert '連續上班檢查採滑動區間計算' in final_spec
assert '## 自動排班現況' not in final_agents
assert '## 班表資料儲存規則' not in final_agents
assert '所有功能需求、介面規則、資料模型與驗收標準' in final_agents

# 移除本次一次性檔案
if WORKFLOW_PATH.exists():
    WORKFLOW_PATH.unlink()
if SCRIPT_PATH.exists():
    SCRIPT_PATH.unlink()
