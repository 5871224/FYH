const fs = require("node:fs");
const path = require("node:path");

const RENDERER_CORE_FILES = [
  "renderer-foundation.js",
  "renderer-settings-navigation.js",
  "renderer-schedule-layout.js",
  "renderer-date-utils.js",
  "renderer-ui-helpers.js",
  "renderer-visibility.js",
  "renderer-state-normalization.js",
  "renderer-schedule-interaction.js",
  "renderer-auto-schedule-compliance.js",
  "renderer-auto-schedule-demand.js",
  "renderer-auto-schedule-assignment.js",
  "renderer-auto-fill-schedule.js",
  "renderer-auto-schedule.js",
  "renderer-schedule-toolbar.js",
  "renderer-schedule-groups.js",
  "renderer-schedule-cells.js",
  "renderer-schedule-table.js",
  "renderer-settings-catalog.js",
  "renderer-settings-department.js",
  "renderer-settings-ordering.js",
  "renderer-settings-member.js",
  "renderer-groups-permissions-archive.js",
  "renderer-auth-context.js",
  "renderer-schedule-tooltip.js",
  "renderer-main-pages.js",
  "renderer-records-views.js",
  "renderer-modal-navigation.js",
  "renderer-schedule-ordering.js",
  "renderer-schedule-keyboard.js",
  "renderer-attendance-page.js",
  "renderer-meal-page.js",
  "renderer-records-page.js",
  "renderer-records-events.js",
  "renderer-runtime-helpers.js",
  "renderer-page-data.js",
  "renderer-records-actions.js",
  "renderer-app-shell.js",
  "renderer-persistence.js",
  "renderer-schedule-selection-actions.js",
  "renderer-schedule-assignment-modals.js",
  "renderer-schedule-compliance-settings.js",
  "renderer-auth-actions.js",
  "renderer-export-actions.js",
  "renderer-events-toolbar.js",
  "renderer-events-session.js",
  "renderer-events-click.js",
  "renderer-events-form.js",
  "renderer-events-tooltip.js",
  "renderer-events-drag.js",
  "renderer-drag-scroll-preserve.js",
  "renderer-events.js",
  "renderer.js",
];

function readRendererCore(rootDir) {
  return RENDERER_CORE_FILES
    .map((file) => fs.readFileSync(path.join(rootDir, "src", "renderer", file), "utf8"))
    .join("\n");
}

module.exports = { RENDERER_CORE_FILES, readRendererCore };
