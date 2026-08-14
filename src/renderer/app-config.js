window.SCHEDULER_CONFIG = {
  supabaseUrl: "https://crxxkazdgsaqwqrppbhy.supabase.co",
  supabaseAnonKey: "sb_publishable_t4QuCEqPIF_q2YO9VYa0QA_z7S3JFt7",
  documentId: "default"
};

// Compatibility for the currently published Supabase bundle.
// The generated app bundle does not persist schedule-table drag order itself,
// so these wrappers write the resulting order through reorderSettings().
(function installPublishedScheduleOrderPersistence() {
  if (typeof document === "undefined") {
    return;
  }

  function install() {
    if (!window.schedulerApi?.reorderSettings || typeof window.getSortableSettingsList !== "function") {
      return;
    }

    const wrap = (functionName, category, label) => {
      const original = window[functionName];
      if (typeof original !== "function" || original.__fyhPersistsOrder) {
        return;
      }

      const wrapped = async function (...args) {
        const changed = await original.apply(this, args);
        if (!changed) {
          return changed;
        }
        try {
          const items = window.getSortableSettingsList(category) || [];
          const orderedIds = items
            .filter((item) => !item.deleted)
            .map((item) => item.id)
            .filter(Boolean);
          if (orderedIds.length) {
            await window.schedulerApi.reorderSettings(category, orderedIds);
          }
        } catch (error) {
          window.setSaveStatus?.(`${label}：${error?.message || error}`);
        }
        return changed;
      };
      wrapped.__fyhPersistsOrder = true;
      window[functionName] = wrapped;
    };

    wrap("reorderScheduleTableDepartment", "department", "單位排序儲存失敗");
    wrap("reorderScheduleTableMember", "member", "人員排序儲存失敗");
  }

  if (document.readyState === "complete") {
    install();
  } else {
    window.addEventListener("load", install, { once: true });
  }
})();
