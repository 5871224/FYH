from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch target: {label}")
    return text.replace(old, new, 1)


meal_path = Path("src/renderer/v2-meal.js")
meal = meal_path.read_text(encoding="utf-8-sig")
old_settings = '''      <div class="records-filter-row">
        <label class="meal-settings-toolbar-label">截止時間 <input type="time" value="${escapeHtml(String(mealAdmin.settings?.daily_cutoff_time || "10:30").slice(0, 5))}" data-meal-cutoff-time></label>
        <label class="meal-settings-toolbar-label">公司補助 <input type="number" min="1" step="1" inputmode="numeric" pattern="[1-9][0-9]*" value="${escapeHtml(String(subsidy))}" data-meal-company-subsidy data-last-valid-company-subsidy="${escapeHtml(String(subsidy))}"></label>
        <button class="ghost-btn compact-btn" type="button" data-add-meal-product="true">新增商品</button>
        <button class="primary-btn compact-btn" type="button" data-save-meal-settings="true">儲存</button>
      </div>'''
new_settings = '''      <div class="meal-admin-toolbar meal-settings-toolbar">
        <div class="meal-toolbar-fields meal-settings-fields">
          <label class="meal-toolbar-field meal-settings-toolbar-label">
            <span>截止時間</span>
            <input type="time" value="${escapeHtml(String(mealAdmin.settings?.daily_cutoff_time || "10:30").slice(0, 5))}" data-meal-cutoff-time>
          </label>
          <label class="meal-toolbar-field meal-settings-toolbar-label">
            <span>公司補助（元）</span>
            <input type="number" min="1" step="1" inputmode="numeric" pattern="[1-9][0-9]*" value="${escapeHtml(String(subsidy))}" data-meal-company-subsidy data-last-valid-company-subsidy="${escapeHtml(String(subsidy))}">
          </label>
        </div>
        <div class="meal-toolbar-actions">
          <button class="ghost-btn" type="button" data-add-meal-product="true">新增商品</button>
          <button class="primary-btn" type="button" data-save-meal-settings="true">儲存設定</button>
        </div>
      </div>'''
meal = replace_once(meal, old_settings, new_settings, "meal settings toolbar")
meal_path.write_text("\ufeff" + meal, encoding="utf-8")

records_path = Path("src/renderer/v2-records.js")
records = records_path.read_text(encoding="utf-8-sig")
pattern = re.compile(
    r'''      <div class="records-filter-row"><input type="date" value="\$\{escapeHtml\(filters\.fromDate\)\}" data-meal-report-filter="fromDate"><input type="date" value="\$\{escapeHtml\(filters\.toDate\)\}" data-meal-report-filter="toDate"><select data-meal-report-filter="departmentId">\$\{departmentOptions\(filters\.departmentId\)\}</select><select data-meal-report-filter="memberId">\$\{memberOptions\(filters\.memberId\)\}</select><select data-meal-report-view><option value="detail" \$\{view === "detail" \? "selected" : ""\}>明細</option><option value="item" \$\{view === "item" \? "selected" : ""\}>品項</option><option value="member" \$\{view === "member" \? "selected" : ""\}>人員</option></select><button class="ghost-btn compact-btn" type="button" data-export-meal-report="true">匯出</button></div>'''
)
new_report = '''      <div class="meal-admin-toolbar meal-report-toolbar">
        <div class="meal-toolbar-fields meal-report-fields">
          <label class="meal-toolbar-field meal-field-from">
            <span>開始日期</span>
            <input type="date" value="${escapeHtml(filters.fromDate)}" data-meal-report-filter="fromDate">
          </label>
          <label class="meal-toolbar-field meal-field-to">
            <span>結束日期</span>
            <input type="date" value="${escapeHtml(filters.toDate)}" data-meal-report-filter="toDate">
          </label>
          <label class="meal-toolbar-field meal-field-department">
            <span>單位</span>
            <select data-meal-report-filter="departmentId">${departmentOptions(filters.departmentId)}</select>
          </label>
          <label class="meal-toolbar-field meal-field-member">
            <span>人員</span>
            <select data-meal-report-filter="memberId">${memberOptions(filters.memberId)}</select>
          </label>
          <label class="meal-toolbar-field meal-field-view">
            <span>報表內容</span>
            <select data-meal-report-view>
              <option value="detail" ${view === "detail" ? "selected" : ""}>明細</option>
              <option value="item" ${view === "item" ? "selected" : ""}>品項</option>
              <option value="member" ${view === "member" ? "selected" : ""}>人員</option>
            </select>
          </label>
        </div>
        <div class="meal-toolbar-actions">
          <button class="ghost-btn" type="button" data-export-meal-report="true">匯出 Excel</button>
        </div>
      </div>'''
records, count = pattern.subn(new_report, records, count=1)
if count != 1:
    raise SystemExit("Missing patch target: meal report toolbar")
records_path.write_text(records, encoding="utf-8")

css_path = Path("src/renderer/ui-system.css")
css = css_path.read_text(encoding="utf-8-sig")
marker = "/* Meal administration toolbar: labelled fields and stable responsive actions. */"
block = r'''

/* Meal administration toolbar: labelled fields and stable responsive actions. */
.meal-admin-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 12px 16px;
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid rgba(156, 107, 47, 0.16);
  border-radius: var(--ui-section-radius);
  background: rgba(255, 253, 248, 0.72);
}

.meal-toolbar-fields {
  display: grid;
  align-items: end;
  gap: 10px;
  min-width: 0;
}

.meal-report-fields {
  grid-template-columns:
    minmax(140px, 160px)
    minmax(140px, 160px)
    minmax(130px, 1fr)
    minmax(130px, 1fr)
    minmax(110px, 130px);
}

.meal-settings-fields {
  grid-template-columns: minmax(150px, 190px) minmax(140px, 170px);
}

.meal-toolbar-field,
.meal-settings-toolbar-label {
  display: grid;
  gap: 5px;
  min-width: 0;
  align-items: stretch;
}

.meal-toolbar-field > span {
  color: var(--ui-muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
}

.meal-toolbar-field input,
.meal-toolbar-field select,
.meal-settings-toolbar-label input[type="number"] {
  width: 100%;
  min-width: 0;
}

.meal-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.meal-toolbar-actions > button {
  min-height: var(--ui-control-height);
}

@media (max-width: 900px) {
  .meal-admin-toolbar {
    grid-template-columns: minmax(0, 1fr);
  }

  .meal-report-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "from to"
      "department department"
      "member view";
  }

  .meal-field-from { grid-area: from; }
  .meal-field-to { grid-area: to; }
  .meal-field-department { grid-area: department; }
  .meal-field-member { grid-area: member; }
  .meal-field-view { grid-area: view; }
}

@media (max-width: 640px) {
  .meal-admin-toolbar {
    gap: 8px;
    margin-bottom: 8px;
    padding: var(--ui-mobile-section-padding);
    border-radius: var(--ui-control-radius);
  }

  .meal-toolbar-fields {
    gap: var(--ui-mobile-gap);
  }

  .meal-settings-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meal-toolbar-actions {
    display: grid;
    width: 100%;
    gap: var(--ui-mobile-gap);
  }

  .meal-report-toolbar .meal-toolbar-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .meal-settings-toolbar .meal-toolbar-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meal-toolbar-actions > button {
    width: 100%;
    min-width: 0;
  }
}
'''
if marker not in css:
    css = css.rstrip() + block + "\n"
css_path.write_text("\ufeff" + css, encoding="utf-8")

spec_path = Path("規格書.txt")
spec = spec_path.read_text(encoding="utf-8-sig")
old_spec = '''5. 價格與數量欄使用固定窄欄，備註欄使用剩餘寬度。
6. 手機版訂餐列間距為 4px，儲存格內距為 4px。'''
new_spec = '''5. 價格與數量欄使用固定窄欄，備註欄使用剩餘寬度。
6. 手機版訂餐列間距為 4px，儲存格內距為 4px。
7. 訂餐統計與訂餐設定的上方控制列使用「欄位區＋操作區」結構；日期、時間、單位、人員、報表內容與公司補助均顯示欄位名稱。
8. 電腦版控制欄位靠左、操作按鈕靠右且與輸入控制項等高；手機版日期使用雙欄，其他篩選依可用寬度整齊分欄，新增、儲存與匯出按鈕使用完整可用寬度。'''
spec = replace_once(spec, old_spec, new_spec, "meal interface specification")
spec_path.write_text("\ufeff" + spec, encoding="utf-8")
