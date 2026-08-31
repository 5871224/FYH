const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(file(relative), "utf8");
const write = (relative, content) => fs.writeFileSync(file(relative), content, "utf8");

function replaceOnce(relative, before, after, label) {
  const source = read(relative);
  const first = source.indexOf(before);
  const second = first < 0 ? -1 : source.indexOf(before, first + before.length);
  if (first < 0 || second >= 0) {
    throw new Error(`${relative}: ${label || "replacement"} expected exactly once`);
  }
  write(relative, source.slice(0, first) + after + source.slice(first + before.length));
}

function replaceRegexOnce(relative, pattern, after, label) {
  const source = read(relative);
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) {
    throw new Error(`${relative}: ${label || pattern} expected once, got ${matches.length}`);
  }
  write(relative, source.replace(pattern, after));
}

function appendFixedTranslations() {
  const relative = "src/renderer/app-config.js";
  const anchor = '    "越文名稱": "Tên tiếng Việt",\n';
  const extra = `    "越文名稱": "Tên tiếng Việt",\n    "所屬人員": "Nhân viên thuộc bộ phận",\n    "預覽": "Xem trước",\n    "假別代碼": "Mã loại nghỉ",\n    "適用單位": "Bộ phận áp dụng",\n    "需求人數": "Số người cần",\n    "排班人員": "Nhân viên xếp ca",\n    "時段": "Khung giờ",\n    "需填時間": "Yêu cầu nhập giờ",\n    "需填原因": "Yêu cầu lý do",\n    "角色名稱": "Tên vai trò",\n    "適用群組": "Nhóm áp dụng",\n    "權限項目": "Quyền hạn",\n    "權限": "Quyền",\n    "在職": "Đang làm việc",\n    "離職": "Đã nghỉ việc",\n    "名稱": "Tên",\n    "上班時間": "Giờ vào ca",\n    "下班時間": "Giờ tan ca",\n    "查看": "Xem",\n    "管理": "Quản lý",\n    "修改單位": "Sửa bộ phận",\n    "新增單位": "Thêm bộ phận",\n    "修改人員": "Sửa nhân viên",\n    "新增人員": "Thêm nhân viên",\n    "修改班別": "Sửa ca",\n    "新增班別": "Thêm ca",\n    "修改假別": "Sửa loại nghỉ",\n    "新增假別": "Thêm loại nghỉ",\n    "修改角色": "Sửa vai trò",\n    "新增角色": "Thêm vai trò",\n    "不顯示於班表": "Không hiển thị trên lịch",\n    "請輸入單位名稱": "Nhập tên bộ phận",\n    "請輸入班別": "Nhập tên ca",\n    "請輸入名稱": "Nhập tên",\n    "輸入姓名": "Nhập họ tên",\n    "可留空": "Có thể để trống",\n    "可留空；越文模式會顯示中文": "Có thể để trống; nếu trống sẽ hiển thị tiếng Trung",\n`;
  replaceOnce(relative, anchor, extra, "fixed Vietnamese settings translations");
}

function updateAppConfig() {
  const relative = "src/renderer/app-config.js";
  replaceOnce(
    relative,
    "  let labels = { groups: [], departments: [], members: [], shifts: [], leaves: [], mealProducts: [] };",
    "  let labels = { groups: [], departments: [], members: [], shifts: [], leaves: [], roles: [], mealProducts: [] };",
    "label categories"
  );
  appendFixedTranslations();
  replaceOnce(
    relative,
    "      leaves: normalizeLabelRows(payload?.leaves),\n      mealProducts: normalizeLabelRows(payload?.mealProducts)",
    "      leaves: normalizeLabelRows(payload?.leaves),\n      roles: normalizeLabelRows(payload?.roles),\n      mealProducts: normalizeLabelRows(payload?.mealProducts)",
    "role labels state"
  );
  replaceOnce(
    relative,
    "    if (payload.accessBundle?.groups) payload.accessBundle.groups = applyLabels(payload.accessBundle.groups, \"groups\");\n    if (payload.status?.products)",
    "    if (payload.accessBundle?.groups) payload.accessBundle.groups = applyLabels(payload.accessBundle.groups, \"groups\");\n    if (payload.accessBundle?.roles) payload.accessBundle.roles = applyLabels(payload.accessBundle.roles, \"roles\");\n    if (payload.status?.products)",
    "role payload enrichment"
  );
  replaceOnce(
    relative,
    "      if (typeof groupFeatureState !== \"undefined\" && groupFeatureState?.bundle?.groups) {\n        groupFeatureState.bundle.groups = applyLabels(groupFeatureState.bundle.groups, \"groups\");\n      }",
    "      if (typeof groupFeatureState !== \"undefined\" && groupFeatureState?.bundle) {\n        groupFeatureState.bundle.groups = applyLabels(groupFeatureState.bundle.groups, \"groups\");\n        groupFeatureState.bundle.roles = applyLabels(groupFeatureState.bundle.roles, \"roles\");\n      }",
    "global role label merge"
  );

  replaceRegexOnce(
    relative,
    /  function currentSession\(\) \{[\s\S]*?\n  function currentEntity\(category\) \{/,
`  let labelRefreshPromise = null;

  function isAuthenticated() {
    return Boolean(window.schedulerApi?.getAuthContext?.()?.authenticated);
  }

  async function refreshLabels() {
    if (!isAuthenticated() || typeof window.schedulerApi?.getVietnameseLabels !== "function") return labels;
    if (labelRefreshPromise) return labelRefreshPromise;
    labelRefreshPromise = Promise.resolve(window.schedulerApi.getVietnameseLabels())
      .then((payload) => {
        setLabels(payload || {});
        mergeGlobalLabels();
        return labels;
      })
      .finally(() => { labelRefreshPromise = null; });
    return labelRefreshPromise;
  }

  function upsertCachedLabel(category, id, nameVi) {
    if (!id) return;
    const rows = labels[category] || [];
    const index = rows.findIndex((row) => row.id === id);
    const next = { id, nameVi: String(nameVi || "").trim() };
    if (index >= 0) rows[index] = next;
    else rows.push(next);
  }

  async function saveLabel(entity, category, id, value) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId || typeof window.schedulerApi?.saveVietnameseLabel !== "function") return;
    await window.schedulerApi.saveVietnameseLabel(entity, normalizedId, String(value || "").trim());
    upsertCachedLabel(category, normalizedId, value);
    mergeGlobalLabels();
  }

  function installApiIntegration() {
    // Vietnamese data access is part of the formal schedulerApi provider.
    // Entity save paths explicitly persist their localized field; no runtime method override is used here.
  }

  function currentEntity(category) {`,
    "replace direct REST and frozen schedulerApi monkey patches"
  );

  replaceOnce(
    relative,
    "      if (category === \"group\") return (typeof groupFeatureState !== \"undefined\" ? groupFeatureState.bundle?.groups : [])?.find((item) => String(item.id) === targetId) || null;\n      if (typeof state === \"undefined\") return null;",
    "      if (category === \"group\") return (typeof groupFeatureState !== \"undefined\" ? groupFeatureState.bundle?.groups : [])?.find((item) => String(item.id) === targetId) || null;\n      if (category === \"role\") return (typeof groupFeatureState !== \"undefined\" ? groupFeatureState.bundle?.roles : [])?.find((item) => String(item.id) === targetId) || null;\n      if (typeof state === \"undefined\") return null;",
    "current role entity"
  );
  replaceOnce(
    relative,
    "    addLocalizedField(\"shiftName\", \"shiftNameVi\", \"shift\");",
    "    addLocalizedField(\"shiftName\", \"shiftNameVi\", \"shift\");\n    addLocalizedField(\"accessRoleName\", \"accessRoleNameVi\", \"role\");",
    "role localized fallback field"
  );
  replaceOnce(
    relative,
    "      if (typeof groupFeatureState !== \"undefined\") add(groupFeatureState.bundle?.groups);",
    "      if (typeof groupFeatureState !== \"undefined\") { add(groupFeatureState.bundle?.groups); add(groupFeatureState.bundle?.roles); }",
    "role dynamic translations"
  );
  replaceOnce(
    relative,
    "  function refreshUi() {\n    ensureLanguageControl();\n    ensureLocalizedFormFields();\n    ensureMealLocalizedColumn();\n    translateDom(document.body);\n  }",
`  function refreshUi() {
    ensureLanguageControl();
    ensureLocalizedFormFields();
    ensureMealLocalizedColumn();
    if (labelsLoaded) mergeGlobalLabels();
    if (isAuthenticated() && !labelsLoaded && !labelRefreshPromise) {
      refreshLabels().then(() => queueMicrotask(refreshUi)).catch((error) => console.warn("讀取越文名稱失敗", error));
    }
    translateDom(document.body);
  }`,
    "refresh labels after login"
  );
  replaceOnce(
    relative,
    "      refreshLabels,\n      refresh: refreshUi",
    "      refreshLabels,\n      saveLabel,\n      refresh: refreshUi",
    "expose localized save helper"
  );
  replaceOnce(
    relative,
    "    if (currentSession()?.access_token) refreshLabels().catch((error) => console.warn(\"讀取越文名稱失敗\", error)).finally(refreshUi);\n    else refreshUi();",
    "    if (isAuthenticated()) refreshLabels().catch((error) => console.warn(\"讀取越文名稱失敗\", error)).finally(refreshUi);\n    else refreshUi();",
    "formal authenticated check"
  );
}

function updateWebApi() {
  const relative = "src/renderer/web-api.js";
  const rpcAnchor = `  async function callRpcAllRows(functionName, payload = {}) {\n    const rows = [];\n    let offset = 0;\n    while (true) {\n      const page = await callRpc(functionName, {\n        ...payload,\n        p_offset: offset,\n        p_limit: RPC_PAGE_SIZE\n      }) || [];\n      if (!Array.isArray(page)) {\n        throw new Error(\`${"${functionName}"} 回傳格式錯誤\`);\n      }\n      rows.push(...page);\n      if (page.length < RPC_PAGE_SIZE) {\n        break;\n      }\n      offset += page.length;\n    }\n    return rows;\n  }`;
  replaceOnce(relative, rpcAnchor, `${rpcAnchor}\n\n  async function getVietnameseLabels() {\n    ensureSignedIn();\n    return callRpc(\"get_vietnamese_labels_v1\", {}) || {};\n  }\n\n  async function saveVietnameseLabel(entity, id, value) {\n    ensureSignedIn();\n    return callRpc(\"save_vietnamese_label_v1\", {\n      p_entity: String(entity || \"\").trim(),\n      p_id: String(id || \"\").trim(),\n      p_value: String(value || \"\").trim()\n    });\n  }`, "formal Vietnamese provider API");

  replaceOnce(
    relative,
    "        fullName: member?.name || \"\",\n        groupId:",
    "        fullName: member?.name || \"\",\n        fullNameVi: member?.nameVi || \"\",\n        groupId:",
    "member Vietnamese payload"
  );

  replaceRegexOnce(
    relative,
    /  async function saveDepartmentItem\(department, sortOrder = 0\) \{[\s\S]*?\n  \}\n\n\n    async function deleteDepartmentItem/,
`  async function saveDepartmentItem(department, sortOrder = 0) {
    ensureSignedIn();
    const result = await callRpc("save_department_v3", {
      p_department: { ...department, sortOrder }
    });
    await saveVietnameseLabel("department", department?.id, department?.nameVi || "");
    return result;
  }


    async function deleteDepartmentItem`,
    "department localized save"
  );
  replaceRegexOnce(
    relative,
    /  async function saveShiftItem\(shift, sortOrder = 0\) \{[\s\S]*?\n  \}\n\n\n    async function saveCatalogItem/,
`  async function saveShiftItem(shift, sortOrder = 0) {
    ensureSignedIn();
    const result = await callRpc("save_shift_v3", {
      p_shift: {
        ...shift,
        applicableDepartmentId: shift?.applicableDeptId || shift?.applicableDepartmentId || "",
        sortOrder
      }
    });
    await saveVietnameseLabel("shift", shift?.id, shift?.nameVi || "");
    return result;
  }


    async function saveCatalogItem`,
    "shift localized save"
  );
  replaceRegexOnce(
    relative,
    /    async function saveCatalogItem\(category, item, sortOrder = 0\) \{[\s\S]*?\n  \}\n\n\n    async function deleteCatalogItem/,
`    async function saveCatalogItem(category, item, sortOrder = 0) {
    ensureSignedIn();
    const result = await callRpc("save_catalog_item_v3", {
      p_category: String(category || ""),
      p_item: { ...item, sortOrder }
    });
    if (String(category || "") === "leave") {
      await saveVietnameseLabel("leave", result?.id || item?.id, item?.nameVi || "");
    }
    return result;
  }


    async function deleteCatalogItem`,
    "leave localized save"
  );

  replaceOnce(
    relative,
    "  async function saveScheduleGroup(group) { return callRpc(\"save_schedule_group_v1\", { p_group: group }); }\n",
`  async function saveScheduleGroup(group) {
    const result = await callRpc("save_schedule_group_v1", { p_group: group });
    await saveVietnameseLabel("group", result?.group?.id || group?.id, group?.nameVi || "");
    return result;
  }
`,
    "group localized save"
  );
  replaceOnce(
    relative,
    "  async function saveAccessRole(role) { return callRpc(\"save_access_role_v1\", { p_role: role }); }\n",
`  async function saveAccessRole(role) {
    const result = await callRpc("save_access_role_v1", { p_role: role });
    await saveVietnameseLabel("role", result?.role?.id || role?.id, role?.nameVi || "");
    return result;
  }
`,
    "role localized save"
  );
  replaceOnce(
    relative,
    "    loadScheduleExportRows,\n    saveDepartmentItem,",
    "    loadScheduleExportRows,\n    getVietnameseLabels,\n    saveVietnameseLabel,\n    saveDepartmentItem,",
    "export localization provider methods"
  );
}

function updateStateNormalization() {
  const relative = "src/renderer/renderer-state-normalization.js";
  replaceOnce(relative, "    name: department?.name || `單位 ${fallbackIndex + 1}`,\n", "    name: department?.name || `單位 ${fallbackIndex + 1}`,\n    nameVi: department?.nameVi || \"\",\n", "department nameVi state");
  replaceOnce(relative, "    name: member?.name || `人員 ${fallbackIndex + 1}`,\n", "    name: member?.name || `人員 ${fallbackIndex + 1}`,\n    nameVi: member?.nameVi || \"\",\n", "member nameVi state");
  replaceOnce(relative, "      name: shift?.name || `班別 ${fallbackIndex + 1}`,\n", "      name: shift?.name || `班別 ${fallbackIndex + 1}`,\n      nameVi: shift?.nameVi || \"\",\n", "shift nameVi state");
  replaceOnce(relative, "    name: item?.name || catalogEntry.name,\n", "    name: item?.name || catalogEntry.name,\n    nameVi: item?.nameVi || \"\",\n", "leave nameVi state");
}

function updateDepartmentRenderer() {
  const relative = "src/renderer/renderer-settings-department.js";
  replaceOnce(
    relative,
    "         <div class=\"department-settings-title\">${escapeHtml(department.name)}</div>",
    "         <div class=\"department-settings-title\"><span>${escapeHtml(department.name)}</span><small class=\"department-settings-name-vi\">${escapeHtml(department.nameVi || \"-\")}</small></div>",
    "department list Vietnamese value"
  );
  replaceOnce(relative, "             <div>單位</div>\n            <div>所屬人員</div>", "             <div>單位<br><span>越文名稱</span></div>\n            <div>所屬人員</div>", "department localized header");
  replaceOnce(
    relative,
    "        <input id=\"departmentName\" type=\"text\" maxlength=\"12\" value=\"${escapeHtml(department.name)}\" placeholder=\"請輸入單位名稱\">\n      </div>\n      <div class=\"form-grid\">",
    "        <input id=\"departmentName\" type=\"text\" maxlength=\"12\" value=\"${escapeHtml(department.name)}\" placeholder=\"請輸入單位名稱\">\n      </div>\n      <div class=\"form-row\">\n        <label for=\"departmentNameVi\">越文名稱</label>\n        <input id=\"departmentNameVi\" type=\"text\" maxlength=\"60\" value=\"${escapeHtml(department.nameVi || \"\")}\" placeholder=\"可留空\">\n      </div>\n      <div class=\"form-grid\">",
    "department form Vietnamese field"
  );
  replaceOnce(
    relative,
    ": { id: \"\", name: \"\", groupId:",
    ": { id: \"\", name: \"\", nameVi: \"\", groupId:",
    "department new localized default"
  );
  replaceOnce(relative, "  const name = document.getElementById(\"departmentName\")?.value.trim();\n", "  const name = document.getElementById(\"departmentName\")?.value.trim();\n  const nameVi = document.getElementById(\"departmentNameVi\")?.value.trim() || \"\";\n", "read department nameVi");
  replaceOnce(relative, "  const payload = { id: mode === \"edit\" ? modalContext.targetId : uid(\"d\"), name, groupId,", "  const payload = { id: mode === \"edit\" ? modalContext.targetId : uid(\"d\"), name, nameVi, groupId,", "save department nameVi");
}

function updateMemberSettingsRenderer() {
  const relative = "src/renderer/renderer-settings-member.js";
  replaceOnce(relative, "    const matchesName = !normalizedName || member.name.toLowerCase().includes(normalizedName);", "    const matchesName = !normalizedName || member.name.toLowerCase().includes(normalizedName) || String(member.nameVi || \"\").toLowerCase().includes(normalizedName);", "search member vi name");
  replaceOnce(relative, "              <div>姓名</div>\n              <div>排班班別</div>", "              <div>姓名</div>\n              <div>越文名稱</div>\n              <div>排班班別</div>", "member list vi header");
  replaceOnce(relative, "                <div class=\"member-table-name\">${escapeHtml(member.name)}</div>\n                <div class=\"member-shift-pill-list\">", "                <div class=\"member-table-name\">${escapeHtml(member.name)}</div>\n                <div class=\"member-table-name-vi\">${escapeHtml(member.nameVi || \"-\")}</div>\n                <div class=\"member-shift-pill-list\">", "member list vi value");
}

function updateCatalogRenderer() {
  const relative = "src/renderer/renderer-settings-catalog.js";
  replaceOnce(
    relative,
    "                 <div>預覽</div>\n                ${category === \"leave\" ? \"<div>假別代碼</div>\" : \"\"}",
    "                 <div>預覽</div>\n                ${category === \"shift\" ? \"<div>越文名稱</div>\" : \"\"}\n                ${category === \"leave\" ? \"<div>假別代碼</div>\" : \"\"}",
    "shift vi header"
  );
  replaceOnce(
    relative,
    "                ${category === \"shift\" ? \"\" : `<div>${category === \"leave\" ? \"假別\" : \"加班\"}</div>`}\n                <div>${category === \"shift\" ? \"適用單位\"",
    "                ${category === \"shift\" ? \"\" : `<div>${category === \"leave\" ? \"假別\" : \"加班\"}</div>`}\n                ${category === \"leave\" ? \"<div>越文名稱</div>\" : \"\"}\n                <div>${category === \"shift\" ? \"適用單位\"",
    "leave vi header"
  );
  replaceOnce(
    relative,
    "                  </div>\n                  ${category === \"leave\" ? `<div class=\"settings-table-code\">${escapeHtml(item.code || \"\")}</div>` : \"\"}",
    "                  </div>\n                  ${category === \"shift\" ? `<div class=\"settings-table-name-vi\">${escapeHtml(item.nameVi || \"-\")}</div>` : \"\"}\n                  ${category === \"leave\" ? `<div class=\"settings-table-code\">${escapeHtml(item.code || \"\")}</div>` : \"\"}",
    "shift vi list value"
  );
  replaceOnce(
    relative,
    "                  ${category === \"shift\" ? \"\" : `<div class=\"settings-table-name\">${escapeHtml(category === \"leave\" ? getLeaveCatalogDisplayName(item) : item.name)}</div>`}\n                  <div class=\"settings-table-meta\">",
    "                  ${category === \"shift\" ? \"\" : `<div class=\"settings-table-name\">${escapeHtml(category === \"leave\" ? getLeaveCatalogDisplayName(item) : item.name)}</div>`}\n                  ${category === \"leave\" ? `<div class=\"settings-table-name-vi\">${escapeHtml(item.nameVi || \"-\")}</div>` : \"\"}\n                  <div class=\"settings-table-meta\">",
    "leave vi list value"
  );
  replaceOnce(relative, "      name: \"\",\n      color:", "      name: \"\",\n      nameVi: \"\",\n      color:", "shift default nameVi");
  replaceOnce(
    relative,
    "      <div class=\"form-section\">\n      <div class=\"form-grid\">",
    "      <div class=\"form-row\">\n        <label for=\"shiftNameVi\">越文名稱</label>\n        <input id=\"shiftNameVi\" type=\"text\" maxlength=\"60\" value=\"${escapeHtml(shift.nameVi || \"\")}\" placeholder=\"可留空\">\n      </div>\n      <div class=\"form-section\">\n      <div class=\"form-grid\">",
    "shift form vi field"
  );
  replaceOnce(relative, "  const name = document.getElementById(\"shiftName\")?.value.trim();\n", "  const name = document.getElementById(\"shiftName\")?.value.trim();\n  const nameVi = document.getElementById(\"shiftNameVi\")?.value.trim() || \"\";\n", "read shift nameVi");
  replaceOnce(relative, "    name,\n    color: modalColor,", "    name,\n    nameVi,\n    color: modalColor,", "save shift nameVi");
  replaceOnce(relative, "      name: category === \"overtime\" ? \"加班\" : LEAVE_CATALOG[0].name,\n      color:", "      name: category === \"overtime\" ? \"加班\" : LEAVE_CATALOG[0].name,\n      nameVi: \"\",\n      color:", "catalog default nameVi");
  replaceOnce(
    relative,
    "        <div class=\"form-section\">\n          <div class=\"form-row checkbox-row checkbox-row-left\">",
    "        <div class=\"form-row\">\n          <label for=\"leaveNameVi\">越文名稱</label>\n          <input id=\"leaveNameVi\" type=\"text\" maxlength=\"60\" placeholder=\"可留空\" value=\"${escapeHtml(item.nameVi || \"\")}\">\n        </div>\n        <div class=\"form-section\">\n          <div class=\"form-row checkbox-row checkbox-row-left\">",
    "leave form vi field"
  );
  replaceOnce(relative, "  const name = document.getElementById(\"leaveCatalogName\")?.value.trim() || \"\";\n", "  const name = document.getElementById(\"leaveCatalogName\")?.value.trim() || \"\";\n  const nameVi = document.getElementById(\"leaveNameVi\")?.value.trim() || \"\";\n", "read leave nameVi");
  replaceOnce(relative, "    code: selectedLeave?.code,\n    name,\n    requiresTime:", "    code: selectedLeave?.code,\n    name,\n    nameVi,\n    requiresTime:", "save leave nameVi");
}

function updateGroupPermissionRenderer() {
  const relative = "src/renderer/renderer-groups-permissions-archive.js";
  replaceOnce(
    relative,
    "<th class=\"permission-role-col\">角色名稱</th><th class=\"permission-group-col\">",
    "<th class=\"permission-role-col\">角色名稱</th><th class=\"permission-role-vi-col\">越文名稱</th><th class=\"permission-group-col\">",
    "role list vi header"
  );
  replaceOnce(
    relative,
    "<td class=\"permission-role-col\">${escapeHtml(role.name)}</td><td class=\"permission-group-col\">",
    "<td class=\"permission-role-col\">${escapeHtml(role.name)}</td><td class=\"permission-role-vi-col\">${escapeHtml(role.nameVi || \"-\")}</td><td class=\"permission-group-col\">",
    "role list vi value"
  );
  replaceOnce(relative, "|| { id: \"\", code: \"\", name: \"\", permissions:", "|| { id: \"\", code: \"\", name: \"\", nameVi: \"\", permissions:", "role default nameVi");
  replaceOnce(
    relative,
    "<label for=\"accessRoleName\">角色名稱</label><input id=\"accessRoleName\" type=\"text\" maxlength=\"30\" value=\"${escapeHtml(role.name)}\"></div><fieldset",
    "<label for=\"accessRoleName\">角色名稱</label><input id=\"accessRoleName\" type=\"text\" maxlength=\"30\" value=\"${escapeHtml(role.name)}\"></div><div class=\"form-row\"><label for=\"accessRoleNameVi\">越文名稱</label><input id=\"accessRoleNameVi\" type=\"text\" maxlength=\"60\" value=\"${escapeHtml(role.nameVi || \"\")}\" placeholder=\"可留空\"></div><fieldset",
    "role form vi field"
  );
  replaceOnce(relative, "  const name = document.getElementById(\"accessRoleName\")?.value.trim() || \"\";\n", "  const name = document.getElementById(\"accessRoleName\")?.value.trim() || \"\";\n  const nameVi = document.getElementById(\"accessRoleNameVi\")?.value.trim() || \"\";\n", "read role nameVi");
  replaceOnce(relative, "{ id: existing?.id || \"\", code: existing?.code || \"\", name, permissions, groupIds }", "{ id: existing?.id || \"\", code: existing?.code || \"\", name, nameVi, permissions, groupIds }", "save role nameVi");

  replaceOnce(relative, "id: \"\", code: \"\", name: \"\", groupId:", "id: \"\", code: \"\", name: \"\", nameVi: \"\", groupId:", "member default nameVi");
  replaceOnce(
    relative,
    "<label for=\"memberName\">姓名</label><input id=\"memberName\" type=\"text\" maxlength=\"12\" value=\"${escapeHtml(member.name)}\"></div><div class=\"form-row\"><label for=\"memberRole\">",
    "<label for=\"memberName\">姓名</label><input id=\"memberName\" type=\"text\" maxlength=\"12\" value=\"${escapeHtml(member.name)}\"></div><div class=\"form-row\"><label for=\"memberNameVi\">越文名稱</label><input id=\"memberNameVi\" type=\"text\" maxlength=\"60\" value=\"${escapeHtml(member.nameVi || \"\")}\" placeholder=\"可留空\"></div><div class=\"form-row\"><label for=\"memberRole\">",
    "member form vi field"
  );
  replaceOnce(
    relative,
    "id: mode === \"edit\" ? modalContext.targetId : uid(\"m\"), code: document.getElementById(\"memberCode\")?.value.trim(), name: document.getElementById(\"memberName\")?.value.trim(),\n    groupId,",
    "id: mode === \"edit\" ? modalContext.targetId : uid(\"m\"), code: document.getElementById(\"memberCode\")?.value.trim(), name: document.getElementById(\"memberName\")?.value.trim(), nameVi: document.getElementById(\"memberNameVi\")?.value.trim() || \"\",\n    groupId,",
    "save member nameVi"
  );
}

function updateMemberEdge() {
  const relative = "supabase/functions/member-auth-admin/index.ts";
  replaceOnce(relative, "  fullName?: string;\n", "  fullName?: string;\n  fullNameVi?: string;\n", "member payload vi type");
  replaceOnce(relative, "  const fullName = String(member?.fullName || \"\").trim();\n", "  const fullName = String(member?.fullName || \"\").trim();\n  const fullNameVi = String(member?.fullNameVi || \"\").trim();\n", "normalize fullNameVi");
  replaceOnce(relative, "    fullName,\n    groupId,", "    fullName,\n    fullNameVi,\n    groupId,", "normalized member vi return");
  replaceOnce(relative, "    full_name: member.fullName,\n    access_role_id:", "    full_name: member.fullName,\n    full_name_vi: member.fullNameVi || null,\n    access_role_id:", "persist member vi");
}

function updateCss() {
  const relative = "src/renderer/css/components.css";
  replaceOnce(
    relative,
    "  grid-template-columns: var(--settings-drag-column-width) 104px minmax(86px, .9fr) minmax(170px, 1.45fr) 64px 108px 84px 78px var(--settings-action-column-width);",
    "  grid-template-columns: var(--settings-drag-column-width) 104px minmax(86px, .9fr) minmax(110px, .95fr) minmax(170px, 1.45fr) 64px 108px 84px 78px var(--settings-action-column-width);",
    "member desktop vi column"
  );
  replaceOnce(
    relative,
    "  grid-template-columns: var(--settings-drag-column-width) minmax(76px, .55fr) minmax(96px, .65fr) minmax(64px, .42fr) minmax(280px, 2.7fr) minmax(92px, .62fr) minmax(68px, .45fr) var(--settings-action-column-width);",
    "  grid-template-columns: var(--settings-drag-column-width) minmax(76px, .55fr) minmax(110px, .8fr) minmax(96px, .65fr) minmax(64px, .42fr) minmax(280px, 2.7fr) minmax(92px, .62fr) minmax(68px, .45fr) var(--settings-action-column-width);",
    "shift vi column"
  );
  replaceOnce(
    relative,
    ".catalog-settings-modal .settings-table-row-leave,\n.catalog-settings-modal .settings-table-row-overtime {\n  grid-template-columns: var(--settings-drag-column-width) repeat(6, minmax(0, 1fr)) var(--settings-action-column-width);\n}",
    ".catalog-settings-modal .settings-table-row-leave {\n  grid-template-columns: var(--settings-drag-column-width) repeat(7, minmax(0, 1fr)) var(--settings-action-column-width);\n}\n\n.catalog-settings-modal .settings-table-row-overtime {\n  grid-template-columns: var(--settings-drag-column-width) repeat(6, minmax(0, 1fr)) var(--settings-action-column-width);\n}",
    "leave vi column"
  );
  replaceOnce(
    relative,
    "    grid-template-columns: var(--settings-drag-column-width) 92px minmax(72px, .85fr) minmax(150px, 1.25fr) 54px 92px 72px 68px var(--settings-action-column-width);",
    "    grid-template-columns: var(--settings-drag-column-width) 92px minmax(72px, .85fr) minmax(96px, .9fr) minmax(150px, 1.25fr) 54px 92px 72px 68px var(--settings-action-column-width);",
    "member tablet vi column"
  );
  const anchor = ".department-settings-modal .department-settings-table-department .department-settings-title {\n  grid-column: 2;\n  order: 0;\n}\n";
  replaceOnce(relative, anchor, `${anchor}\n.department-settings-title {\n  display: grid;\n  gap: 2px;\n}\n\n.department-settings-name-vi {\n  color: var(--ui-muted);\n  font-size: 11px;\n  font-weight: 600;\n  line-height: 1.25;\n}\n`, "department vi subfield styling");
}

function mergeCanonicalVietnameseSql() {
  const updatesPath = "supabase/002_current_updates.sql";
  const oldPath = "supabase/003_vietnamese_display_names.sql";
  let sql = read(oldPath).replace(/^\uFEFF/, "");
  sql = sql.replace(
    "alter table public.meal_products add column if not exists name_vi text;",
    "alter table public.meal_products add column if not exists name_vi text;\nalter table public.access_roles add column if not exists name_vi text;"
  );
  sql = sql.replace(
    "comment on column public.meal_products.name_vi is 'Vietnamese display name; blank falls back to name.';",
    "comment on column public.meal_products.name_vi is 'Vietnamese display name; blank falls back to name.';\ncomment on column public.access_roles.name_vi is 'Vietnamese display name; blank falls back to name.';"
  );
  sql = sql.replace(
    "    'mealProducts', coalesce((",
`    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nameVi', coalesce(r.name_vi, '')) order by r.sort_order, r.name)
      from public.access_roles r
    ), '[]'::jsonb),
    'mealProducts', coalesce((`
  );
  sql = sql.replace(
    "    when 'meal_product' then\n      if not public.has_access_permission(v_user_id, 'meal_admin') then",
`    when 'role' then
      if not public.has_access_permission(v_user_id, 'permission_settings') then
        raise exception '沒有權限設定權限' using errcode = '42501';
      end if;
      update public.access_roles set name_vi = v_value, updated_at = now()
      where id = p_id;

    when 'meal_product' then
      if not public.has_access_permission(v_user_id, 'meal_admin') then`
  );
  if (!sql.includes("access_roles add column if not exists name_vi") || !sql.includes("when 'role' then")) {
    throw new Error("failed to extend Vietnamese SQL for roles");
  }
  const current = read(updatesPath).replace(/\s*$/, "\n");
  if (current.includes("get_vietnamese_labels_v1")) throw new Error("002 already contains Vietnamese canonical block");
  write(updatesPath, `${current}\n-- ============================================================================\n-- Canonical Vietnamese display names\n-- ============================================================================\n${sql.trim()}\n`);
  fs.unlinkSync(file(oldPath));
}

function updateVietnameseTests() {
  const relative = "tests/vietnamese-localization.test.js";
  write(relative, `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Vietnamese localization uses the formal scheduler API and agreed fields", () => {
  const config = read("src/renderer/app-config.js");
  const webApi = read("src/renderer/web-api.js");
  assert.doesNotThrow(() => new vm.Script(config, { filename: "app-config.js" }));
  ["fyh.language", "zh-TW", "vi-VN", "roles: normalizeLabelRows", "departmentNameVi", "memberNameVi", "shiftNameVi", "leaveNameVi", "accessRoleNameVi"].forEach((token) => assert.ok(config.includes(token), `missing localization token: ${token}`));
  assert.ok(webApi.includes("async function getVietnameseLabels()"));
  assert.ok(webApi.includes("async function saveVietnameseLabel(entity, id, value)"));
  assert.ok(config.includes("window.schedulerApi.getVietnameseLabels()"));
  assert.ok(config.includes("window.schedulerApi.saveVietnameseLabel"));
  assert.doesNotMatch(config.slice(config.indexOf("function installVietnameseLocalization")), /session\.access_token/);
  assert.doesNotMatch(config.slice(config.indexOf("function installVietnameseLocalization")), /api\[name\]\s*=\s*wrapped/);
});

test("Vietnamese fixed UI covers settings lists, forms, home and attendance review", () => {
  const source = read("src/renderer/app-config.js");
  [
    '"修改密碼": "Đổi mật khẩu"',
    '"單位設定": "Cài đặt bộ phận"',
    '"人員設定": "Cài đặt nhân viên"',
    '"班別設定": "Cài đặt ca"',
    '"假別設定": "Cài đặt loại nghỉ"',
    '"權限設定": "Cài đặt quyền"',
    '"越文名稱": "Tên tiếng Việt"',
    '"所屬人員": "Nhân viên thuộc bộ phận"',
    '"角色名稱": "Tên vai trò"',
    '"適用群組": "Nhóm áp dụng"',
    '"權限項目": "Quyền hạn"',
    '"修改單位": "Sửa bộ phận"',
    '"修改人員": "Sửa nhân viên"',
    '"修改班別": "Sửa ca"',
    '"修改假別": "Sửa loại nghỉ"',
    '"修改角色": "Sửa vai trò"',
    '"批次審核": "Duyệt hàng loạt"'
  ].forEach((token) => assert.ok(source.includes(token), `missing Vietnamese fixed label: ${token}`));
  assert.match(source, /actions\.insertBefore\(shell, passwordButton\)/);
  assert.doesNotMatch(source, /position:fixed;right:10px;bottom:10px/);
});

test("settings renderers expose Vietnamese columns and edit fields", () => {
  const department = read("src/renderer/renderer-settings-department.js");
  const member = read("src/renderer/renderer-settings-member.js");
  const catalog = read("src/renderer/renderer-settings-catalog.js");
  const permission = read("src/renderer/renderer-groups-permissions-archive.js");
  ["departmentNameVi", "department.nameVi"].forEach((token) => assert.ok(department.includes(token)));
  ["越文名稱", "member.nameVi"].forEach((token) => assert.ok(member.includes(token)));
  ["shiftNameVi", "leaveNameVi", "item.nameVi"].forEach((token) => assert.ok(catalog.includes(token)));
  ["accessRoleNameVi", "memberNameVi", "role.nameVi"].forEach((token) => assert.ok(permission.includes(token)));
});

test("Vietnamese schema is canonical, includes roles, and excludes overtime and holidays", () => {
  const sql = read("supabase/002_current_updates.sql");
  assert.equal(fs.existsSync(path.join(root, "supabase/003_vietnamese_display_names.sql")), false);
  [
    "schedule_groups add column if not exists name_vi",
    "set_departments add column if not exists name_vi",
    "set_employee add column if not exists full_name_vi",
    "set_shift add column if not exists name_vi",
    "set_leave add column if not exists name_vi",
    "meal_products add column if not exists name_vi",
    "access_roles add column if not exists name_vi",
    "get_vietnamese_labels_v1",
    "save_vietnamese_label_v1",
    "when 'role' then",
    "permission_settings"
  ].forEach((token) => assert.ok(sql.includes(token), `missing canonical Vietnamese SQL token: ${token}`));
  assert.doesNotMatch(sql, /alter table public\.set_overtime\s+add column if not exists name_vi/i);
  assert.doesNotMatch(sql, /alter table public\.holidays\s+add column if not exists name_vi/i);
});

test("member save persists Vietnamese full name through the member Edge function", () => {
  const webApi = read("src/renderer/web-api.js");
  const edge = read("supabase/functions/member-auth-admin/index.ts");
  assert.ok(webApi.includes("fullNameVi: member?.nameVi"));
  assert.ok(edge.includes("fullNameVi?: string"));
  assert.ok(edge.includes("full_name_vi: member.fullNameVi || null"));
});
`);
}

updateAppConfig();
updateWebApi();
updateStateNormalization();
updateDepartmentRenderer();
updateMemberSettingsRenderer();
updateCatalogRenderer();
updateGroupPermissionRenderer();
updateMemberEdge();
updateCss();
mergeCanonicalVietnameseSql();
updateVietnameseTests();

console.log("Vietnamese settings transformation complete");
