/* 設定彈窗捲動位置與返回狀態
 * 由 renderer.js 第一階段拆分；維持既有全域 bundle 執行方式。
 */

function getSettingsScrollElement(selector = "") {
  if (selector) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }
  const candidates = [
    ".department-settings-modal .modal-body",
    ".member-settings-modal .member-table-scroll",
    ".catalog-settings-modal .settings-table-scroll",
    ".member-settings-modal .member-table-wrap",
    ".catalog-settings-modal .settings-table-wrap",
    ".settings-table-scroll",
    ".member-table-scroll",
    ".settings-table-wrap",
    ".member-table-wrap",
    ".modal-body"
  ];
  return candidates
    .map((candidate) => document.querySelector(candidate))
    .find((element) => element instanceof HTMLElement && element.scrollHeight > element.clientHeight + 1)
    || candidates.map((candidate) => document.querySelector(candidate)).find((element) => element instanceof HTMLElement)
    || null;
}

function captureSettingsReturnContext(fallback = null) {
  const scrollElement = getSettingsScrollElement();
  return {
    ...(fallback || {}),
    scrollSelector: scrollElement?.matches(".department-settings-modal .modal-body")
      ? ".department-settings-modal .modal-body"
      : scrollElement?.matches(".member-settings-modal .member-table-scroll")
        ? ".member-settings-modal .member-table-scroll"
        : scrollElement?.matches(".catalog-settings-modal .settings-table-scroll")
          ? ".catalog-settings-modal .settings-table-scroll"
          : "",
    scrollTop: scrollElement?.scrollTop || 0
  };
}

function restoreSettingsScroll(context) {
  if (!context || !Number.isFinite(Number(context.scrollTop))) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollElement = getSettingsScrollElement(context.scrollSelector || "");
      if (scrollElement) {
        scrollElement.scrollTop = Number(context.scrollTop) || 0;
      }
    });
  });
}


async function reopenSettingsModalPreservingScroll(context) {
  if (!context?.category) {
    return false;
  }
  if (context.category === "department-settings") {
    await openDepartmentSettings();
  } else if (context.category === "member-settings") {
    await openMemberSettings();
  } else if (context.category === "list-settings" && context.listCategory) {
    openListSettings(context.listCategory);
  } else {
    return false;
  }
  restoreSettingsScroll(context);
  return true;
}
