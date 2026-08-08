const fs = require('node:fs');

function read(path) { return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n'); }
function write(path, text) { fs.writeFileSync(path, text.replace(/\r\n/g, '\n'), 'utf8'); }
function replaceExact(path, before, after, count = 1) {
  let text = read(path);
  const actual = text.split(before).length - 1;
  if (actual !== count) throw new Error(`${path}: expected ${count} exact matches, got ${actual}`);
  text = text.split(before).join(after);
  write(path, text);
}
function replaceFunction(sql, name, replacement) {
  const marker = `create or replace function public.${name}`;
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error(`SQL function not found: ${name}`);
  if (sql.indexOf(marker, start + marker.length) >= 0) throw new Error(`Duplicate SQL function before refactor: ${name}`);
  const end = sql.indexOf('\n$$;', start);
  if (end < 0) throw new Error(`SQL function terminator not found: ${name}`);
  return sql.slice(0, start) + replacement.trimEnd() + sql.slice(end + 4);
}

// 1. Do not preload admin-only employee directory just to open schedule.
replaceExact(
  'src/renderer/renderer-events-click.js',
  '          await ensureScheduleApplicationLoaded();\n          if (hasPermission("member_settings")) await ensureManagerDirectoryLoaded();\n          appView = "schedule";',
  '          await ensureScheduleApplicationLoaded();\n          appView = "schedule";'
);

// 2. Attendance review is loaded only when the review tab is first opened.
replaceExact(
  'src/renderer/renderer-events-click.js',
  '    if (target.dataset.recordsTab) {\n      recordsState.activeTab = target.dataset.recordsTab;\n      renderAll();\n      return;\n    }',
  '    if (target.dataset.recordsTab) {\n      const nextTab = target.dataset.recordsTab;\n      recordsState.activeTab = nextTab;\n      if (nextTab === "review" && hasPermission("attendance_review") && !ensureAttendanceReviewState().loaded) {\n        await loadAttendanceReview();\n      } else {\n        renderAll();\n      }\n      return;\n    }'
);
replaceExact(
  'src/renderer/renderer-records-page.js',
  '    if (hasPermission("attendance_review")) await loadAttendanceReview(false);\n',
  ''
);
replaceExact(
  'src/renderer/renderer-records-page.js',
  '    loading: Boolean(current.loading),\n    rows: current.rows || [],',
  '    loading: Boolean(current.loading),\n    loaded: Boolean(current.loaded),\n    rows: current.rows || [],'
);
replaceExact(
  'src/renderer/renderer-records-page.js',
  '        ...recordsState.attendanceReview,\n        loading: false,\n        rows: result.rows || [],',
  '        ...recordsState.attendanceReview,\n        loading: false,\n        loaded: true,\n        rows: result.rows || [],'
);
replaceExact(
  'src/renderer/renderer-records-page.js',
  '        ...recordsState.attendanceReview,\n        loading: false,\n        rows: [],\n        error: error.message || "讀取簽到審核失敗"',
  '        ...recordsState.attendanceReview,\n        loading: false,\n        loaded: false,\n        rows: [],\n        error: error.message || "讀取簽到審核失敗"'
);
replaceExact(
  'src/renderer/renderer-foundation.js',
  '    attendanceReview: {\n      loading: false,\n      rows: [],',
  '    attendanceReview: {\n      loading: false,\n      loaded: false,\n      rows: [],'
);

// 3. ExcelJS is loaded only when an XLSX import/export is actually requested.
let exporter = read('src/renderer/browser-exporter.js');
const exporterHead = '(function installBrowserExporter() {\n';
if (!exporter.startsWith(exporterHead)) throw new Error('browser-exporter.js header changed');
const lazyLoader = `  const EXCELJS_SRC = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";\n  let excelJsPromise = null;\n\n  async function ensureExcelJS() {\n    if (window.ExcelJS?.Workbook) return window.ExcelJS;\n    if (!excelJsPromise) {\n      excelJsPromise = new Promise((resolve, reject) => {\n        const existing = document.querySelector('script[data-fyh-exceljs="true"]');\n        const script = existing || document.createElement("script");\n        const done = () => {\n          if (window.ExcelJS?.Workbook) resolve(window.ExcelJS);\n          else reject(new Error("ExcelJS 載入失敗"));\n        };\n        script.addEventListener("load", done, { once: true });\n        script.addEventListener("error", () => {\n          excelJsPromise = null;\n          reject(new Error("ExcelJS 載入失敗"));\n        }, { once: true });\n        if (!existing) {\n          script.src = EXCELJS_SRC;\n          script.async = true;\n          script.dataset.fyhExceljs = "true";\n          document.head.appendChild(script);\n        }\n      });\n    }\n    return excelJsPromise;\n  }\n\n`;
exporter = exporterHead + lazyLoader + exporter.slice(exporterHead.length);
let workbookFunctionCount = 0;
exporter = exporter.replace(/(async function [A-Za-z0-9_]+\([^)]*\) \{\n)(    const workbook = new ExcelJS\.Workbook\(\);)/g, (_m, head, workbookLine) => {
  workbookFunctionCount += 1;
  return `${head}    await ensureExcelJS();\n${workbookLine}`;
});
if (workbookFunctionCount < 10) throw new Error(`Expected >=10 ExcelJS workbook functions, got ${workbookFunctionCount}`);
exporter = exporter.replace('  window.schedulerBrowserExporter = {\n    buildSapLeaveCsvContent,', '  window.schedulerBrowserExporter = {\n    ensureExcelJS,\n    buildSapLeaveCsvContent,');
write('src/renderer/browser-exporter.js', exporter);

let webApi = read('src/renderer/web-api.js');
let directWorkbookCount = 0;
webApi = webApi.replace(/(^\s*)const workbook = new ExcelJS\.Workbook\(\);/gm, (_m, indent) => {
  directWorkbookCount += 1;
  return `${indent}await exporter.ensureExcelJS();\n${indent}const workbook = new ExcelJS.Workbook();`;
});
if (directWorkbookCount !== 1) throw new Error(`Expected one direct ExcelJS workbook in web-api.js, got ${directWorkbookCount}`);
write('src/renderer/web-api.js', webApi);

let indexHtml = read('src/renderer/index.html');
const excelScript = '  <script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>\n';
if (!indexHtml.includes(excelScript)) throw new Error('ExcelJS eager script tag not found');
indexHtml = indexHtml.replace(excelScript, '');
write('src/renderer/index.html', indexHtml);

// 4. Database hot paths: resolve actor permission + allowed groups once per RPC.
let sql = read('supabase/002_current_updates.sql');
const bootstrapSql = `create or replace function public.get_scheduler_bootstrap_v3(p_document_id text default 'default')\nreturns jsonb\nlanguage sql\nstable\nsecurity definer\nset search_path=public,pg_catalog\nas $$\nwith actor as materialized (\n  select employee.access_role_id\n  from public.set_employee employee\n  join public.access_roles role on role.id=employee.access_role_id\n  where employee.id=(select auth.uid())\n    and employee.deleted_at is null\n    and 'schedule_view'=any(coalesce(role.permissions,'{}'::text[]))\n    and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)\n  limit 1\n),\nallowed_groups as materialized (\n  select role_group.group_id\n  from actor\n  join public.access_role_groups role_group on role_group.role_id=actor.access_role_id\n),\nvisible_schedule as materialized (\n  select entry.*\n  from public.schedule_entries entry\n  join allowed_groups allowed on allowed.group_id=entry.group_id\n  where not exists(\n    select 1 from public.schedule_archives archive\n    where archive.group_id=entry.group_id\n      and entry.work_date between archive.start_date and archive.end_date\n  )\n),\nvisible_departments as (\n  select department.*\n  from public.set_departments department\n  join allowed_groups allowed on allowed.group_id=department.group_id\n  where department.deleted_at is null\n     or exists(\n       select 1\n       from visible_schedule entry\n       left join public.set_employee member on member.id=entry.member_id\n       where entry.support_department_id=department.id\n          or (entry.support_department_id is null and member.home_department_id=department.id)\n     )\n),\nvisible_members as (\n  select member.*\n  from public.set_employee member\n  join allowed_groups allowed on allowed.group_id=member.group_id\n  where member.deleted_at is null\n     or exists(select 1 from visible_schedule entry where entry.member_id=member.id)\n),\nvisible_shifts as (\n  select shift.*\n  from public.set_shift shift\n  join allowed_groups allowed on allowed.group_id=shift.group_id\n  where shift.deleted_at is null\n     or exists(select 1 from visible_schedule entry where entry.shift_type_id=shift.id)\n),\nvisible_leaves as (\n  select leave_item.*\n  from public.set_leave leave_item\n  where leave_item.deleted_at is null\n     or exists(select 1 from visible_schedule entry where entry.leave_type_id=leave_item.id)\n),\nvisible_overtime as (\n  select overtime_item.*\n  from public.set_overtime overtime_item\n  where overtime_item.deleted_at is null\n     or exists(select 1 from visible_schedule entry where entry.overtime_type_id=overtime_item.id)\n)\nselect case when exists(select 1 from actor) then jsonb_build_object(\n  'settings',coalesce((select to_jsonb(setting) from public.scheduler_settings setting where setting.id=coalesce(nullif(p_document_id,''),'default') limit 1),'{}'::jsonb),\n  'departments',coalesce((select jsonb_agg(jsonb_build_object(\n    'id',department.id,'name',department.name,'group_id',department.group_id,'start_date',department.start_date,'end_date',department.end_date,\n    'hidden_from_schedule',department.hidden_from_schedule,'sort_order',department.sort_order,'deleted_at',department.deleted_at\n  ) order by department.sort_order,department.name,department.id) from visible_departments department),'[]'::jsonb),\n  'members',coalesce((select jsonb_agg(jsonb_build_object(\n    'id',member.id,'employee_code',member.employee_code,'full_name',member.full_name,'group_id',member.group_id,'access_role_id',member.access_role_id,\n    'home_department_id',member.home_department_id,'hire_date',member.hire_date,'leave_date',member.leave_date,'pay_by_day',member.pay_by_day,\n    'fixed_rest_weekday',member.fixed_rest_weekday,'schedule_shift_ids',member.schedule_shift_ids,'monthly_rest_days',member.monthly_rest_days,\n    'sort_order',member.sort_order,'role',member.role,'deleted_at',member.deleted_at\n  ) order by member.sort_order,member.full_name,member.id) from visible_members member),'[]'::jsonb),\n  'shifts',coalesce((select jsonb_agg(to_jsonb(shift) order by shift.sort_order,shift.name,shift.id) from visible_shifts shift),'[]'::jsonb),\n  'leaves',coalesce((select jsonb_agg(to_jsonb(leave_item) order by leave_item.sort_order,leave_item.code,leave_item.id) from visible_leaves leave_item),'[]'::jsonb),\n  'overtime',coalesce((select jsonb_agg(to_jsonb(overtime_item) order by overtime_item.sort_order,overtime_item.name,overtime_item.id) from visible_overtime overtime_item),'[]'::jsonb),\n  'holidays',coalesce((select jsonb_agg(to_jsonb(holiday) order by holiday.sort_order,holiday.holiday_date,holiday.id) from public.holidays holiday),'[]'::jsonb),\n  'accessBundle',public.get_group_access_bundle_v1(),\n  'entityMap',public.get_group_entity_map_v1()\n) else null end\n$$;`;
const entriesSql = `create or replace function public.get_schedule_entries_v3(p_start_date date,p_end_date date)\nreturns setof public.schedule_entries\nlanguage sql\nstable\nsecurity definer\nset search_path=public,pg_catalog\nas $$\n  with actor as materialized (\n    select employee.access_role_id\n    from public.set_employee employee\n    join public.access_roles role on role.id=employee.access_role_id\n    where employee.id=(select auth.uid())\n      and employee.deleted_at is null\n      and 'schedule_view'=any(coalesce(role.permissions,'{}'::text[]))\n      and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)\n    limit 1\n  ),\n  allowed_groups as materialized (\n    select role_group.group_id\n    from actor\n    join public.access_role_groups role_group on role_group.role_id=actor.access_role_id\n  )\n  select entry.*\n  from public.schedule_entries entry\n  join allowed_groups allowed on allowed.group_id=entry.group_id\n  where p_start_date is not null\n    and p_end_date is not null\n    and p_start_date<=p_end_date\n    and entry.work_date between p_start_date and p_end_date\n  order by entry.work_date,entry.member_id\n$$;`;
const saveSql = `create or replace function public.save_schedule_entries_v3(entries jsonb)\nreturns setof public.schedule_entries\nlanguage plpgsql\nsecurity definer\nset search_path=public,pg_catalog\nas $$\ndeclare\n  v_role_id uuid;\n  v_invalid boolean:=false;\nbegin\n  select employee.access_role_id\n  into v_role_id\n  from public.set_employee employee\n  join public.access_roles role on role.id=employee.access_role_id\n  where employee.id=(select auth.uid())\n    and employee.deleted_at is null\n    and 'schedule_manage'=any(coalesce(role.permissions,'{}'::text[]))\n    and public.is_employee_account_effective(employee.hire_date,employee.leave_date,(timezone('Asia/Taipei',now()))::date)\n  limit 1;\n\n  if v_role_id is null then\n    raise exception '沒有班表管理權限' using errcode='42501';\n  end if;\n  if entries is null or jsonb_typeof(entries)<>'array' then\n    raise exception '班表資料格式錯誤' using errcode='22023';\n  end if;\n\n  with incoming as materialized (\n    select *\n    from jsonb_to_recordset(entries) as item(\n      member_id uuid,work_date date,delete_entry boolean,support_department_id uuid,\n      shift_type_id uuid,leave_type_id uuid,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,\n      overtime_type_id uuid,overtime_start_time time,overtime_end_time time,\n      overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,\n      overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text,note text\n    )\n  )\n  select exists(\n    select 1\n    from incoming item\n    left join public.set_employee member on member.id=item.member_id\n    where item.member_id is null\n       or item.work_date is null\n       or member.id is null\n       or member.group_id is null\n       or not exists(\n         select 1 from public.access_role_groups allowed\n         where allowed.role_id=v_role_id and allowed.group_id=member.group_id\n       )\n       or exists(\n         select 1 from public.schedule_archives archive\n         where archive.group_id=member.group_id\n           and item.work_date between archive.start_date and archive.end_date\n       )\n       or (member.deleted_at is not null and not (\n         coalesce(item.delete_entry,false)\n         or (item.shift_type_id is null and item.leave_type_id is null and item.overtime_type_id is null)\n       ))\n  ) into v_invalid;\n\n  if v_invalid then\n    raise exception '包含無權管理、已封存或已刪除人員的班表資料' using errcode='42501';\n  end if;\n\n  return query\n  with incoming as materialized (\n    select * from jsonb_to_recordset(entries) as item(\n      member_id uuid,work_date date,delete_entry boolean,support_department_id uuid,\n      shift_type_id uuid,leave_type_id uuid,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,\n      overtime_type_id uuid,overtime_start_time time,overtime_end_time time,\n      overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,\n      overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text,note text\n    )\n  ),\n  deleted as (\n    delete from public.schedule_entries entry using incoming item\n    where entry.member_id=item.member_id and entry.work_date=item.work_date\n      and (coalesce(item.delete_entry,false) or (item.shift_type_id is null and item.leave_type_id is null and item.overtime_type_id is null))\n    returning entry.*\n  ),\n  upserted as (\n    insert into public.schedule_entries(\n      member_id,work_date,support_department_id,shift_type_id,leave_type_id,leave_all_day,leave_start_time,leave_end_time,leave_reason,\n      overtime_type_id,overtime_start_time,overtime_end_time,overtime_use_rest_1,overtime_rest_1_start_time,overtime_rest_1_end_time,\n      overtime_use_rest_2,overtime_rest_2_start_time,overtime_rest_2_end_time,overtime_reason,note\n    )\n    select item.member_id,item.work_date,item.support_department_id,item.shift_type_id,item.leave_type_id,coalesce(item.leave_all_day,true),\n      case when item.leave_type_id is null then null else item.leave_start_time end,\n      case when item.leave_type_id is null then null else item.leave_end_time end,\n      case when item.leave_type_id is null then null else item.leave_reason end,\n      item.overtime_type_id,\n      case when item.overtime_type_id is null then null else item.overtime_start_time end,\n      case when item.overtime_type_id is null then null else item.overtime_end_time end,\n      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_1,false) end,\n      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_1,false) then null else item.overtime_rest_1_start_time end,\n      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_1,false) then null else item.overtime_rest_1_end_time end,\n      case when item.overtime_type_id is null then false else coalesce(item.overtime_use_rest_2,false) end,\n      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_2,false) then null else item.overtime_rest_2_start_time end,\n      case when item.overtime_type_id is null or not coalesce(item.overtime_use_rest_2,false) then null else item.overtime_rest_2_end_time end,\n      case when item.overtime_type_id is null then null else item.overtime_reason end,\n      item.note\n    from incoming item\n    where not coalesce(item.delete_entry,false)\n      and (item.shift_type_id is not null or item.leave_type_id is not null or item.overtime_type_id is not null)\n    on conflict(member_id,work_date) do update set\n      support_department_id=excluded.support_department_id,\n      shift_type_id=excluded.shift_type_id,leave_type_id=excluded.leave_type_id,leave_all_day=excluded.leave_all_day,\n      leave_start_time=excluded.leave_start_time,leave_end_time=excluded.leave_end_time,leave_reason=excluded.leave_reason,\n      overtime_type_id=excluded.overtime_type_id,overtime_start_time=excluded.overtime_start_time,overtime_end_time=excluded.overtime_end_time,\n      overtime_use_rest_1=excluded.overtime_use_rest_1,overtime_rest_1_start_time=excluded.overtime_rest_1_start_time,overtime_rest_1_end_time=excluded.overtime_rest_1_end_time,\n      overtime_use_rest_2=excluded.overtime_use_rest_2,overtime_rest_2_start_time=excluded.overtime_rest_2_start_time,overtime_rest_2_end_time=excluded.overtime_rest_2_end_time,\n      overtime_reason=excluded.overtime_reason,note=excluded.note,updated_at=now()\n    returning *\n  )\n  select * from upserted;\nend\n$$;`;
sql = replaceFunction(sql, 'get_scheduler_bootstrap_v3', bootstrapSql);
sql = replaceFunction(sql, 'get_schedule_entries_v3', entriesSql);
sql = replaceFunction(sql, 'save_schedule_entries_v3', saveSql);

// RLS is defense-in-depth only: browser roles have no table grants, so direct-write policies are removed.
const obsoleteWritePolicies = [
  ['holidays','write_holidays'], ['scheduler_settings','write_scheduler_settings'], ['meal_products','write_meal_products'], ['meal_settings','write_meal_settings'],
  ['schedule_entries','insert_schedule_entries'], ['schedule_entries','update_schedule_entries'], ['schedule_entries','delete_schedule_entries'],
  ['set_departments','insert_set_departments_group'], ['set_departments','update_set_departments_group'],
  ['set_employee','insert_set_employee'], ['set_employee','update_set_employee'],
  ['set_leave','insert_set_leave'], ['set_leave','update_set_leave'],
  ['set_overtime','insert_set_overtime'], ['set_overtime','update_set_overtime'],
  ['set_shift','insert_set_shift_group'], ['set_shift','update_set_shift_group']
];
for (const [table, policy] of obsoleteWritePolicies) {
  const createRe = new RegExp(`create policy ${policy} on public\\.${table}\\n[\\s\\S]*?;\\n`, 'g');
  sql = sql.replace(createRe, '');
}
// Make auth.uid() an init-plan value inside every remaining policy.
sql = sql.replace(/create policy[\s\S]*?;\n/g, (block) => {
  let next = block.replace(/\(select auth\.uid\(\)\)/g, 'auth.uid()');
  next = next.replace(/auth\.uid\(\)/g, '(select auth.uid())');
  return next;
});
const policyCleanupMarker = '-- Canonical RPC-only table access: authenticated has no direct write policies.';
if (!sql.includes(policyCleanupMarker)) {
  sql += `\n\nbegin;\n${policyCleanupMarker}\n` + obsoleteWritePolicies.map(([table, policy]) => `drop policy if exists ${policy} on public.${table};`).join('\n') + '\ncommit;\n';
}
write('supabase/002_current_updates.sql', sql);

// 5. Permanent architecture guard for these performance rules.
const perfTest = `const test = require("node:test");\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\n\nconst read = (path) => fs.readFileSync(path, "utf8");\n\ntest("heavy admin/review data is lazy-loaded", () => {\n  const clicks = read("src/renderer/renderer-events-click.js");\n  const records = read("src/renderer/renderer-records-page.js");\n  assert.doesNotMatch(clicks, /ensureScheduleApplicationLoaded\\(\\);\\s*if \\(hasPermission\\(\"member_settings\"\\)\\) await ensureManagerDirectoryLoaded/);\n  const personalLoader = records.match(/async function loadRecordsPage[\\s\\S]*?async function loadAttendanceReview/)[0];\n  assert.doesNotMatch(personalLoader, /loadAttendanceReview\\(false\\)/);\n  assert.match(clicks, /nextTab === \"review\"[\\s\\S]*!ensureAttendanceReviewState\\(\\)\\.loaded/);\n});\n\ntest("ExcelJS is lazy-loaded", () => {\n  const html = read("src/renderer/index.html");\n  const exporter = read("src/renderer/browser-exporter.js");\n  assert.doesNotMatch(html, /exceljs(?:\\.min)?\\.js/i);\n  assert.match(exporter, /async function ensureExcelJS\\(\\)/);\n  assert.match(exporter, /await ensureExcelJS\\(\\);/);\n});\n\ntest("schedule hot RPCs materialize actor access instead of row-by-row permission helpers", () => {\n  const sql = read("supabase/002_current_updates.sql");\n  const getEntries = sql.match(/create or replace function public\\.get_schedule_entries_v3[\\s\\S]*?\\n\\$\\$;/)[0];\n  const saveEntries = sql.match(/create or replace function public\\.save_schedule_entries_v3[\\s\\S]*?\\n\\$\\$;/)[0];\n  assert.match(getEntries, /actor as materialized/);\n  assert.match(getEntries, /allowed_groups as materialized/);\n  assert.doesNotMatch(getEntries, /can_access_group\\(/);\n  assert.match(saveEntries, /v_role_id uuid/);\n  assert.doesNotMatch(saveEntries, /can_access_group\\(/);\n});\n\ntest("authenticated direct-write RLS policies are not recreated", () => {\n  const sql = read("supabase/002_current_updates.sql");\n  for (const name of ${JSON.stringify(obsoleteWritePolicies.map(([, policy]) => policy))}) {\n    assert.doesNotMatch(sql, new RegExp(`create policy ${name} `));\n  }\n});\n`;
write('tests/performance-architecture.test.js', perfTest);

// 6. Documentation.
function appendDoc(path, marker, body) {
  let text = read(path).trimEnd();
  if (!text.includes(marker)) text += `\n\n${body.trim()}\n`;
  write(path, text);
}
appendDoc('README.md', '## 效能與載入原則', `## 效能與載入原則\n\n- 首頁只載入登入身分與權限摘要；第一次進班表才載班表資料，人員管理完整資料只在人員設定開啟時載入。\n- 個人簽到簿不預載簽到審核；只有切換到「簽到審核」時才第一次讀取。\n- ExcelJS 屬大型非核心相依套件，只在 XLSX 匯入／匯出實際發生時動態載入。\n- 班表高頻 RPC 先一次解析目前使用者的角色與適用群組，再以集合式 JOIN 篩選；禁止在每一列班表上重複呼叫 can_access_group/has_access_permission。\n- 核心資料表維持 anon/authenticated 無直接 GRANT；因此不建立 authenticated 直接 INSERT/UPDATE/DELETE RLS policy。RLS 只作唯讀防線，正式寫入一律走具名 RPC／Edge Function。\n- 資料庫 DDL 或權限調整後，需重新檢查 Supabase Performance Advisor；auth RLS init-plan 與 multiple permissive policy 警告不可無理由新增。`);
appendDoc('AGENTS.md', '### 效能守門規則', `### 效能守門規則\n\n- 不得為了開啟班表預先下載人員管理專用欄位；完整人員目錄只能由人員設定功能 lazy load。\n- 個人記錄與簽到審核為不同資料生命週期，不得在載入個人記錄時順帶查簽到審核。\n- 大型匯出套件（目前為 ExcelJS）不得放在首頁 eager script；必須在匯入／匯出動作才載入。\n- 班表批次讀寫 SQL 必須先物化 actor/allowed groups，再集合式處理；禁止 row-by-row 權限 helper。\n- Browser 核心資料表沒有直接寫入 GRANT，因此也不得恢復 authenticated 的直接寫入 RLS policy；具名 RPC／Edge Function 是唯一正式寫入入口。\n- 新增 RLS 時 auth.uid()/auth.jwt() 要使用 init-plan 形式，並避免同一 role/action 存在多個 permissive policy。`);
appendDoc('規格書.md', '### 效能與載入規範（2026-08-08）', `### 效能與載入規範（2026-08-08）\n\n1. 登入後首頁只取得身分與權限摘要，不載入班表、人員管理完整資料、簽到審核或 Excel 匯出套件。\n2. 第一次進班表才取得班表 bootstrap 與目前週期資料；具有「人員設定」權限也不得因此預載人員管理目錄。\n3. 個人簽到簿只取得個人記錄；簽到審核在使用者實際切換到審核分頁時才載入，載入成功後同一 Session 可沿用快取，篩選／異動時才重查。\n4. ExcelJS 僅在 XLSX 匯入或匯出時動態載入；CSV 匯出不得因此載入 ExcelJS。\n5. 班表讀寫 RPC 必須一次解析 actor 的 access_role_id、permissions 與 allowed groups，再使用 JOIN/EXISTS 做集合式驗證；不得對每筆 schedule_entries 反覆查 set_employee/access_roles/access_role_groups。\n6. 核心表對 anon/authenticated 不提供直接 CRUD GRANT；正式寫入只走具名 RPC／Edge Function，因此 authenticated 不保留直接 INSERT/UPDATE/DELETE RLS policy。\n7. RLS 唯讀 policy 中的 auth.uid()/auth.jwt() 應採 init-plan 寫法，並避免同一 role/action 疊加多個 permissive policy。\n8. DDL、權限或高頻 RPC 調整後需檢查 Performance Advisor 與 pg_stat_statements；不可只以目前資料量小作為忽略效能問題的理由。`);

console.log('Performance refactor source changes applied.');
