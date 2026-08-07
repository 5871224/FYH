(() => {
  const CHIP_SELECTOR = '#shiftChips [data-chip-type="shift"][data-chip-id], #leaveChips [data-chip-type="leave"][data-chip-id]';

  function clearToolbarChipHints(scope = document) {
    scope.querySelectorAll(CHIP_SELECTOR).forEach((chip) => chip.removeAttribute("title"));
  }

  function combineToolbarCategories(toolbarGrid) {
    const shiftSection = toolbarGrid.querySelector(".toolbar-section-combined");
    const leaveSection = toolbarGrid.querySelector(".toolbar-section-leave");
    if (!shiftSection || !leaveSection) return;

    let categoryGroup = toolbarGrid.querySelector(".toolbar-category-group");
    if (!categoryGroup) {
      categoryGroup = document.createElement("div");
      categoryGroup.className = "toolbar-category-group";
      toolbarGrid.insertBefore(categoryGroup, shiftSection);
    }
    categoryGroup.append(shiftSection, leaveSection);
  }

  function installCompactToolbarStyles() {
    document.getElementById("fyhToolbarStackedLayoutStyles")?.remove();
    document.getElementById("fyhToolbarCompactStyles")?.remove();

    const style = document.createElement("style");
    style.id = "fyhToolbarCompactStyles";
    style.textContent = `
      .toolbar-floating-card {
        bottom: 0 !important;
        grid-template-columns: auto minmax(0, 1fr) !important;
        grid-template-rows: auto !important;
        align-items: start !important;
        gap: 4px 8px !important;
        max-height: min(38vh, 280px) !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: 6px 8px !important;
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }

      .toolbar-control-stack {
        grid-column: 1;
        grid-row: 1;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        min-width: 80px;
      }

      .toolbar-control-primary,
      .toolbar-control-history {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .toolbar-control-stack #toolbarCollapseToggle,
      .toolbar-control-stack #scheduleUndoButton,
      .toolbar-control-stack #scheduleRedoButton {
        position: static !important;
        box-sizing: border-box;
        width: 38px;
        min-width: 38px;
        margin: 0 !important;
        padding: 0 !important;
      }

      .toolbar-control-stack #toolbarCollapseToggle {
        height: 38px;
        min-height: 38px;
        border: 1px solid var(--ui-accent-strong);
        border-radius: 10px;
        background: linear-gradient(135deg, var(--ui-accent) 0%, var(--ui-accent-strong) 100%);
        color: #fff;
        box-shadow: 0 5px 12px rgba(72, 52, 31, 0.18);
      }

      .toolbar-control-stack #scheduleUndoButton,
      .toolbar-control-stack #scheduleRedoButton {
        height: 32px;
        min-height: 32px;
        border-radius: 8px;
        background: rgba(255, 253, 248, 0.96);
      }

      .toolbar-control-primary .toolbar-selected-preview {
        flex: 0 0 38px;
        width: 38px;
        min-width: 38px;
        height: 38px;
        min-height: 38px;
        padding: 3px;
        border-radius: 7px;
        font-size: 10px;
      }

      .toolbar-floating-card > .toolbar-grid {
        grid-column: 2;
        grid-row: 1 !important;
        display: block !important;
        width: 100%;
        min-width: 0;
      }

      .toolbar-category-group {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-width: 0;
        padding: 3px 6px;
        border: 1px solid rgba(156, 107, 47, 0.16);
        border-radius: 12px;
        background: var(--panel-strong);
      }

      .toolbar-category-group > .toolbar-section-combined,
      .toolbar-category-group > .toolbar-section-leave {
        display: flex !important;
        align-items: flex-start !important;
        flex-wrap: nowrap !important;
        gap: 5px !important;
        min-width: 0;
        padding: 4px 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
      }

      .toolbar-category-group > .toolbar-section-leave {
        margin-top: 2px;
        padding-top: 6px !important;
        border-top: 1px solid var(--schedule-grid-line, var(--line)) !important;
      }

      .toolbar-floating-card .toolbar-title-row,
      .toolbar-floating-card .toolbar-title-row-combined {
        display: flex !important;
        flex: 0 0 auto;
        align-items: center !important;
        flex-wrap: nowrap !important;
        gap: 4px !important;
        min-width: max-content;
        min-height: 30px;
      }

      .toolbar-floating-card .toolbar-title {
        font-size: 13px;
        line-height: 1.1;
      }

      .toolbar-floating-card .toolbar-settings-btn {
        width: 26px;
        min-width: 26px;
        height: 26px;
        min-height: 26px;
        flex-basis: 26px;
      }

      .toolbar-floating-card #deptFilter {
        width: 104px;
        min-width: 104px;
        max-width: 104px;
        height: 30px;
        padding: 4px 25px 4px 9px;
        border-radius: 9px;
        font-size: 12px;
      }

      .toolbar-floating-card #restComplianceButton {
        min-height: 28px;
        padding: 0 8px;
        border-radius: 8px;
        font-size: 12px;
      }

      .toolbar-floating-card #shiftChips,
      .toolbar-floating-card #leaveChips {
        display: flex !important;
        flex: 1 1 auto;
        align-items: center;
        align-content: flex-start;
        flex-wrap: wrap !important;
        gap: 4px !important;
        min-width: 0;
        min-height: 0;
        overflow: visible !important;
        padding: 3px;
        scrollbar-width: none;
      }

      .toolbar-floating-card #shiftChips::-webkit-scrollbar,
      .toolbar-floating-card #leaveChips::-webkit-scrollbar {
        display: none;
      }

      .toolbar-floating-card #shiftChips .chip,
      .toolbar-floating-card #leaveChips .chip {
        flex: 0 0 auto;
        height: 30px;
        min-height: 30px;
        padding: 0 8px !important;
        border-radius: 6px !important;
        font-size: 12px;
        line-height: 1.1;
      }

      .toolbar-floating-card #shiftChips .chip.active,
      .toolbar-floating-card #leaveChips .chip.active {
        position: relative;
        z-index: 1;
        border-color: rgba(255, 255, 255, 0.96) !important;
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.92),
          0 0 0 2px #3f2d1d !important;
        transform: none !important;
      }

      .toolbar-floating-card.toolbar-floating-card-collapsed {
        bottom: 0 !important;
        grid-template-columns: auto !important;
        grid-template-rows: auto !important;
        padding: 5px !important;
        border-bottom-left-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }

      .toolbar-floating-card.toolbar-floating-card-collapsed > .toolbar-grid {
        display: none !important;
      }

      @media (max-width: 768px) {
        .toolbar-floating-card {
          bottom: 0 !important;
          max-height: min(44dvh, 300px) !important;
          padding: 5px 6px !important;
        }

        .toolbar-control-stack {
          min-width: 76px;
        }

        .toolbar-control-stack #toolbarCollapseToggle,
        .toolbar-control-stack #scheduleUndoButton,
        .toolbar-control-stack #scheduleRedoButton,
        .toolbar-control-primary .toolbar-selected-preview {
          width: 36px;
          min-width: 36px;
        }

        .toolbar-control-stack #toolbarCollapseToggle,
        .toolbar-control-primary .toolbar-selected-preview {
          height: 36px;
          min-height: 36px;
        }

        .toolbar-control-stack #scheduleUndoButton,
        .toolbar-control-stack #scheduleRedoButton {
          height: 30px;
          min-height: 30px;
        }

        .toolbar-category-group > .toolbar-section-combined {
          flex-wrap: wrap !important;
        }

        .toolbar-category-group > .toolbar-section-combined > #shiftChips {
          display: contents !important;
        }

        .toolbar-category-group > .toolbar-section-combined,
        .toolbar-category-group > .toolbar-section-leave {
          gap: 4px !important;
        }

        .toolbar-floating-card #shiftChips .chip,
        .toolbar-floating-card #leaveChips .chip {
          height: 28px;
          min-height: 28px;
          padding-right: 7px !important;
          padding-left: 7px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  window.addEventListener("DOMContentLoaded", () => {
    const toolbarGrid = document.getElementById("toolbarGrid");
    if (!toolbarGrid) return;

    combineToolbarCategories(toolbarGrid);
    installCompactToolbarStyles();

    if (typeof renderToolbar === "function" && !window.__FYH_TOOLBAR_HINTS_REMOVED__) {
      window.__FYH_TOOLBAR_HINTS_REMOVED__ = true;
      const baseRenderToolbar = renderToolbar;
      renderToolbar = function renderToolbarWithoutDoubleClickHints(...args) {
        const result = baseRenderToolbar.apply(this, args);
        clearToolbarChipHints(toolbarGrid);
        return result;
      };
    }

    clearToolbarChipHints(toolbarGrid);
    new MutationObserver(() => clearToolbarChipHints(toolbarGrid)).observe(toolbarGrid, {
      childList: true,
      subtree: true
    });
  });
})();
