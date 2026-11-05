const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = (name) => fs.readFileSync(path.resolve(__dirname, "../src/renderer", name), "utf8");

function harness({ shift = true, leave = true, edit = false } = {}) {
  let now = 1000;
  const opened = [], selected = [], handlers = {};
  const containers = { shiftChips: { innerHTML: "" }, leaveChips: { innerHTML: "" }, overtimeChips: { innerHTML: "" } };
  class Chip {
    constructor(type, id) { this.dataset = { chipType: type, chipId: id }; }
    closest(selector) {
      if (selector === "button, td") return this;
      if (selector.includes("#shiftChips [data-chip-type=")) return ["shift", "leave"].includes(this.dataset.chipType) && !!this.dataset.chipId ? this : null;
      return null;
    }
  }
  const state = { selected: { type: null, id: null } };
  let rendered = 0;
  const context = vm.createContext({
    Date: { now: () => now }, state, Element: Chip, HTMLElement: Chip,
    document: { getElementById: (id) => containers[id], body: { addEventListener: (name, fn) => { handlers[name] = fn; } } },
    canManageSchedule: () => shift, canEditSchedule: () => shift && edit,
    hasCommonPermission: (name) => name === "leave_settings" && leave,
    getItemTextColor: () => "#111", getLocalizedName: (item) => item.name, escapeHtml: (v) => String(v),
    renderTable: () => { rendered++; }, selectChip: (type, id) => selected.push({ type, id }),
    openShiftFormModal: (mode, id) => opened.push({ type: "shift", mode, id }),
    openNamedColorFormModal: (type, mode, id) => opened.push({ type, mode, id })
  });
  vm.runInContext(read("renderer-schedule-toolbar.js") + "\n" + read("renderer-events-click.js"), context);
  context.renderToolbar = () => { rendered++; };
  context.bindDelegatedClickEvents();
  const chip = (type, id) => new Chip(type, id);
  return {
    opened, selected, containers, state, renders: () => rendered,
    render: (type) => context.renderChips(type + "Chips", type, [{ id: "item", name: "測試", color: "#fff" }]),
    click: async (type, id) => handlers.click({ target: chip(type, id) }),
    double: async (type, id) => handlers.dblclick({ target: chip(type, id), preventDefault() {}, stopPropagation() {} }),
    tick: (ms) => { now += ms; }
  };
}

test("檢視模式有權限可雙擊班別與假別，取消色塊仍停用", () => {
  const h = harness();
  for (const type of ["shift", "leave"]) {
    h.render(type);
    const html = h.containers[type + "Chips"].innerHTML;
    assert.doesNotMatch(html.split('data-chip-id="item"')[1].split("</button>")[0], /disabled/);
    assert.match(html, new RegExp('data-chip-type="cancel-' + type + '"[^>]*disabled'));
  }
  h.render("overtime");
  assert.match(h.containers.overtimeChips.innerHTML, /data-chip-id="item"[^>]*disabled/);
});

test("未開啟班表編輯雙擊可修改班別假別，單擊不排班", async () => {
  const h = harness();
  await h.click("shift", "day"); h.tick(140); await h.click("shift", "day"); await h.double("shift", "day");
  assert.deepEqual(h.opened, [{ type: "shift", mode: "edit", id: "day" }]);
  h.tick(900);
  await h.click("leave", "annual"); h.tick(140); await h.click("leave", "annual"); await h.double("leave", "annual");
  assert.deepEqual(h.opened[1], { type: "leave", mode: "edit", id: "annual" });
  assert.deepEqual(h.selected, []);
  assert.equal(h.state.selected.type, null);
  assert.equal(h.renders(), 0);
});

test("共用假別設定權限不授予班別修改，無權限也不能雙擊", async () => {
  const h = harness({ shift: false, leave: true });
  h.render("shift"); h.render("leave");
  assert.match(h.containers.shiftChips.innerHTML, /data-chip-id="item"[^>]*disabled/);
  assert.doesNotMatch(h.containers.leaveChips.innerHTML.split('data-chip-id="item"')[1].split("</button>")[0], /disabled/);
  await h.double("shift", "day"); await h.double("leave", "annual");
  assert.deepEqual(h.opened, [{ type: "leave", mode: "edit", id: "annual" }]);
  const none = harness({ shift: false, leave: false });
  await none.double("shift", "day"); await none.double("leave", "annual");
  assert.deepEqual(none.opened, []);
});

test("編輯模式單擊選取與雙擊修改沿用原行為", async () => {
  const h = harness({ edit: true });
  await h.click("shift", "day");
  assert.deepEqual(h.selected, [{ type: "shift", id: "day" }]);
  h.tick(140); await h.click("shift", "day"); await h.double("shift", "day");
  assert.deepEqual(h.opened, [{ type: "shift", mode: "edit", id: "day" }]);
  assert.equal(h.state.selected.id, "day");
  assert.equal(h.renders(), 2);
});
