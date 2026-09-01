const fs = require('node:fs');

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one match, got ${count}`);
  fs.writeFileSync(path, source.replace(before, after), 'utf8');
}

replaceOnce(
  'src/renderer/css/foundation.css',
  `/* 越文模式使用針對越南文字形優化的 Be Vietnam Pro；載入失敗時回退系統字體。 */\nhtml[lang="vi"] body,\nhtml[lang="vi"] button,\nhtml[lang="vi"] input,\nhtml[lang="vi"] select,\nhtml[lang="vi"] textarea {\n  font-family: "Be Vietnam Pro", "Segoe UI", Arial, sans-serif;\n}\n`,
  `/* 只有語系層確認為越文的文字才使用 Be Vietnam Pro；數字、英文與資料內容維持原本字體。 */\nhtml[lang="vi"] .fyh-vi-text {\n  font-family: "Be Vietnam Pro", "Microsoft JhengHei UI", "PingFang TC", sans-serif;\n  font-synthesis: none;\n}\n\nhtml[lang="vi"] .fyh-vi-placeholder::placeholder {\n  font-family: "Be Vietnam Pro", "Microsoft JhengHei UI", "PingFang TC", sans-serif;\n  font-synthesis: none;\n}\n`
);

replaceOnce(
  'src/renderer/app-config.js',
  `      const entities = entityTranslationMap();\n      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);\n      const nodes = [];\n      while (walker.nextNode()) nodes.push(walker.currentNode);\n      nodes.forEach((node) => {\n        const parent = node.parentElement;\n        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return;\n        const next = translateText(node.nodeValue || "", entities);\n        if (next !== node.nodeValue) node.nodeValue = next;\n      });\n`,
  `      const entities = entityTranslationMap();\n      const viTextValues = new Set([...fixedVi.values(), ...entities.values()]\n        .map((value) => String(value || "").trim())\n        .filter(Boolean));\n      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);\n      const nodes = [];\n      while (walker.nextNode()) nodes.push(walker.currentNode);\n      nodes.forEach((node) => {\n        const parent = node.parentElement;\n        if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return;\n        const before = node.nodeValue || "";\n        const next = translateText(before, entities);\n        if (next !== before) {\n          node.nodeValue = next;\n          parent.classList.add("fyh-vi-text");\n        } else if (viTextValues.has(String(before).trim())) {\n          parent.classList.add("fyh-vi-text");\n        }\n      });\n`
);

replaceOnce(
  'src/renderer/app-config.js',
  `          const next = translateText(value, entities).trim();\n          if (next !== value) element.setAttribute(attribute, next);\n`,
  `          const next = translateText(value, entities).trim();\n          if (next !== value) {\n            element.setAttribute(attribute, next);\n            if (attribute === "placeholder") element.classList.add("fyh-vi-placeholder");\n          }\n`
);

replaceOnce(
  'src/renderer/index.html',
  'family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap',
  'family=Be+Vietnam+Pro:wght@400;500;600&display=swap'
);

fs.writeFileSync('tests/vietnamese-font.test.js', `const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\n\ntest('越文只套用 Be Vietnam Pro 到實際翻譯文字並限制最粗 600', () => {\n  const foundation = fs.readFileSync('src/renderer/css/foundation.css', 'utf8');\n  const index = fs.readFileSync('src/renderer/index.html', 'utf8');\n  const config = fs.readFileSync('src/renderer/app-config.js', 'utf8');\n\n  assert.match(index, /fonts\\.googleapis\\.com\\/css2\\?family=Be\\+Vietnam\\+Pro:wght@400;500;600&display=swap/);\n  assert.doesNotMatch(index, /Be\\+Vietnam\\+Pro:wght@400;500;600;700;800/);\n  assert.match(foundation, /html\\[lang="vi"\\] \\.fyh-vi-text \\{[\\s\\S]*font-family: "Be Vietnam Pro"[\\s\\S]*font-synthesis: none;/);\n  assert.doesNotMatch(foundation, /html\\[lang="vi"\\] body,[\\s\\S]*font-family: "Be Vietnam Pro"/);\n  assert.match(foundation, /html,\\s*body \\{[\\s\\S]*font-family: "Microsoft JhengHei UI", "PingFang TC", sans-serif;/);\n  assert.ok(config.includes('parent.classList.add("fyh-vi-text")'));\n  assert.ok(config.includes('element.classList.add("fyh-vi-placeholder")'));\n});\n\ntest('發布版保留越文字體範圍設定', () => {\n  const css = fs.readFileSync('docs/app.css', 'utf8');\n  const index = fs.readFileSync('docs/index.html', 'utf8');\n  assert.match(css, /html\\[lang="vi"\\] \\.fyh-vi-text \\{[\\s\\S]*font-family: "Be Vietnam Pro"/);\n  assert.doesNotMatch(css, /html\\[lang="vi"\\] body,[\\s\\S]*font-family: "Be Vietnam Pro"/);\n  assert.match(index, /family=Be\\+Vietnam\\+Pro:wght@400;500;600&display=swap/);\n});\n`, 'utf8');
