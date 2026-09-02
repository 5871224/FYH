from pathlib import Path

path = Path('src/renderer/renderer-groups-permissions-archive.js')
text = path.read_text(encoding='utf-8')
marker = '''function syncPermissionUi() {\n  ensureGroupSelector();\n  ensureFunctionMenuButtons();\n'''
helper = '''function syncFunctionMenuCategoryVisibility() {\n  document.querySelectorAll("#coreActionsMenu .core-actions-menu-category").forEach((category) => {\n    const submenuButtons = Array.from(category.querySelectorAll(":scope > .core-actions-submenu > button"));\n    const visible = submenuButtons.some((button) => !button.hidden && button.style.display !== "none");\n    category.style.display = visible ? "" : "none";\n    const trigger = category.querySelector(":scope > .core-actions-menu-trigger");\n    if (trigger) trigger.tabIndex = visible ? 0 : -1;\n  });\n}\n\nfunction syncPermissionUi() {\n  ensureGroupSelector();\n  ensureFunctionMenuButtons();\n'''
if marker not in text:
    raise SystemExit('syncPermissionUi marker not found')
text = text.replace(marker, helper, 1)
old = '''  Object.entries(visibility).forEach(([id, visible]) => {\n    const element = document.getElementById(id);\n    if (!element) return;\n    element.style.display = visible ? "" : "none";\n    element.disabled = !visible;\n  });\n'''
new = old + '''  syncFunctionMenuCategoryVisibility();\n'''
if old not in text:
    raise SystemExit('visibility loop not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

test_path = Path('tests/function-menu-permission-mapping.test.js')
test_text = test_path.read_text(encoding='utf-8')
append = '''\n\ntest("功能選單父分類只在至少一個子功能可見時顯示", () => {\n  assert.ok(groups.includes("function syncFunctionMenuCategoryVisibility()"));\n  assert.ok(groups.includes('category.querySelectorAll(":scope > .core-actions-submenu > button")'));\n  assert.ok(groups.includes('button.style.display !== "none"'));\n  assert.ok(groups.includes("syncFunctionMenuCategoryVisibility();"));\n});\n'''
if '功能選單父分類只在至少一個子功能可見時顯示' not in test_text:
    test_text += append
test_path.write_text(test_text, encoding='utf-8')
