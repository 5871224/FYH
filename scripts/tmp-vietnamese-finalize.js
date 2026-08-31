const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content, "utf8");
}

function replaceOnce(relative, before, after, label) {
  let source = read(relative);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${relative}: missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${relative}: duplicate ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
  write(relative, source);
}

function removeRange(relative, startMarker, endMarker, label) {
  let source = read(relative);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`${relative}: missing ${label}`);
  source = source.slice(0, start) + source.slice(end);
  write(relative, source);
}

const groupFile = "src/renderer/renderer-groups-permissions-archive.js";
replaceOnce(
  groupFile,
  'const group = getAllGroups().find((item) => item.id === groupId) || { id: "", code: "", name: "", mealEnabled: false, status: "active", sortOrder: getAllGroups().length };',
  'const group = getAllGroups().find((item) => item.id === groupId) || { id: "", code: "", name: "", nameVi: "", mealEnabled: false, status: "active", sortOrder: getAllGroups().length };',
  "group fallback"
);
replaceOnce(
  groupFile,
  '<div class="form-row"><label for="groupName">群組名稱</label><input id="groupName" type="text" maxlength="30" value="${escapeHtml(group.name)}"></div><div class="form-row"><label class="checkbox-row">',
  '<div class="form-row"><label for="groupName">群組名稱</label><input id="groupName" type="text" maxlength="30" value="${escapeHtml(group.name)}"></div><div class="form-row"><label for="groupNameVi">越文名稱</label><input id="groupNameVi" type="text" maxlength="60" value="${escapeHtml(group.nameVi || "")}" placeholder="可留空；越文模式會顯示中文"></div><div class="form-row"><label class="checkbox-row">',
  "group Vietnamese field"
);
replaceOnce(
  groupFile,
  '  const name = document.getElementById("groupName")?.value.trim() || "";\n  if (!code || !name)',
  '  const name = document.getElementById("groupName")?.value.trim() || "";\n  const nameVi = document.getElementById("groupNameVi")?.value.trim() || "";\n  if (!code || !name)',
  "group Vietnamese value"
);
replaceOnce(
  groupFile,
  'await window.schedulerApi.saveScheduleGroup({ id: existing?.id || "", code, name, mealEnabled:',
  'await window.schedulerApi.saveScheduleGroup({ id: existing?.id || "", code, name, nameVi, mealEnabled:',
  "group Vietnamese payload"
);

const mealViewFile = "src/renderer/renderer-records-views.js";
replaceOnce(
  mealViewFile,
  '<thead><tr><th class="meal-settings-drag-col"></th><th class="meal-settings-name-col">品項</th><th class="meal-settings-price-col">價格</th><th class="meal-settings-active-col">啟用</th><th class="meal-settings-operation-col">操作</th></tr></thead>',
  '<thead><tr><th class="meal-settings-drag-col"></th><th class="meal-settings-name-col">品項</th><th class="meal-settings-name-col">越文名稱</th><th class="meal-settings-price-col">價格</th><th class="meal-settings-active-col">啟用</th><th class="meal-settings-operation-col">操作</th></tr></thead>',
  "meal Vietnamese header"
);
replaceOnce(
  mealViewFile,
  '<td class="meal-settings-name-col"><input type="text" value="${escapeHtml(product.name || "")}" data-meal-product-field="name"></td>\n            <td class="meal-settings-price-col">',
  '<td class="meal-settings-name-col"><input type="text" value="${escapeHtml(product.name || "")}" data-meal-product-field="name"></td>\n            <td class="meal-settings-name-col"><input type="text" maxlength="60" value="${escapeHtml(product.nameVi || product.name_vi || "")}" data-meal-product-field="nameVi" placeholder="可留空"></td>\n            <td class="meal-settings-price-col">',
  "meal Vietnamese input"
);

const mealActionFile = "src/renderer/renderer-records-actions.js";
replaceOnce(
  mealActionFile,
  '    name: row.querySelector(\'[data-meal-product-field="name"]\')?.value || "",\n    price:',
  '    name: row.querySelector(\'[data-meal-product-field="name"]\')?.value || "",\n    nameVi: row.querySelector(\'[data-meal-product-field="nameVi"]\')?.value?.trim() || "",\n    price:',
  "meal Vietnamese payload"
);

const configFile = "src/renderer/app-config.js";
removeRange(
  configFile,
  "  function upsertCachedLabel(",
  "  function entityTranslationMap() {",
  "runtime localized field injection block"
);
replaceOnce(
  configFile,
  '    ensureLanguageControl();\n    ensureLocalizedFormFields();\n    ensureMealLocalizedColumn();\n',
  '    ensureLanguageControl();\n',
  "runtime localized field injection calls"
);

const sqlFile = "supabase/002_current_updates.sql";
const sqlAnchor = "comment on column public.access_roles.name_vi is 'Vietnamese display name; blank falls back to name.';\n\n";
const mealFunction = `create or replace function public.save_meal_admin_settings(
  p_products jsonb,
  p_daily_cutoff_time text,
  p_company_subsidy integer,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  item jsonb;
  v_id uuid;
  v_name text;
  v_name_vi text;
  v_price numeric(10,2);
  v_active boolean;
  v_sort integer := 0;
begin
  if not public.has_access_permission(p_operator_user_id, 'meal_admin') then
    raise exception '沒有訂餐管理權限' using errcode = '42501';
  end if;
  if p_company_subsidy is null or p_company_subsidy <= 0 then
    raise exception '公司補助只能輸入正整數';
  end if;
  if coalesce(p_daily_cutoff_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception '訂餐截止時間格式錯誤';
  end if;

  insert into public.meal_settings(id, daily_cutoff_time, company_subsidy, updated_by, updated_at)
  values ('default', p_daily_cutoff_time::time, p_company_subsidy, p_operator_user_id, now())
  on conflict(id) do update
  set daily_cutoff_time = excluded.daily_cutoff_time,
      company_subsidy = excluded.company_subsidy,
      updated_by = excluded.updated_by,
      updated_at = now();

  if jsonb_typeof(coalesce(p_products, '[]'::jsonb)) <> 'array' then
    raise exception '訂餐品項格式錯誤';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) loop
    begin
      v_id := nullif(btrim(item->>'id'), '')::uuid;
    exception when invalid_text_representation then
      raise exception '品項識別碼格式錯誤';
    end;
    if v_id is null then v_id := gen_random_uuid(); end if;
    v_name := btrim(coalesce(item->>'name', ''));
    if v_name = '' then raise exception '品項名稱不可空白'; end if;
    v_name_vi := nullif(btrim(coalesce(item->>'nameVi', item->>'name_vi', '')), '');
    v_price := coalesce((item->>'price')::numeric, 0);
    if v_price < 0 then raise exception '品項價格不可小於 0'; end if;
    v_active := coalesce((item->>'is_active')::boolean, (item->>'isActive')::boolean, true);
    v_sort := coalesce((item->>'sort_order')::integer, (item->>'sortOrder')::integer, v_sort);

    insert into public.meal_products(id, name, name_vi, price, is_active, sort_order, updated_at)
    values(v_id, v_name, v_name_vi, v_price, v_active, v_sort, now())
    on conflict(id) do update
    set name = excluded.name,
        name_vi = excluded.name_vi,
        price = excluded.price,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        updated_at = now();
    v_sort := v_sort + 1;
  end loop;

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(coalesce(p_products, '[]'::jsonb)));
end
$$;

`;
let sql = read(sqlFile);
if (sql.includes("v_name_vi text;")) throw new Error(`${sqlFile}: meal Vietnamese persistence already present`);
if (!sql.includes(sqlAnchor)) throw new Error(`${sqlFile}: missing Vietnamese comment anchor`);
sql = sql.replace(sqlAnchor, sqlAnchor + mealFunction);
write(sqlFile, sql);

console.log("Vietnamese formal persistence finalization applied");
