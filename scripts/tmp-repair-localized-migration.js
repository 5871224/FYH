const fs = require('node:fs');
const path = 'scripts/tmp-localized-settings-columns.js';
let source = fs.readFileSync(path, 'utf8');
const oldBlock = `replaceOnce(\n  'src/renderer/renderer-schedule-toolbar.js',\n  \`>\${'\${escapeHtml(department.name)}'}</option>\`,\n  \`>\${'\${escapeHtml(getLocalizedName(department))}'}</option>\`\n);\n// The same option template occurs twice; update the remaining occurrence separately.\nreplaceOnce(\n  'src/renderer/renderer-schedule-toolbar.js',\n  \`>\${'\${escapeHtml(department.name)}'}</option>\`,\n  \`>\${'\${escapeHtml(getLocalizedName(department))}'}</option>\`\n);`;
const newBlock = `\n{\n  const path = 'src/renderer/renderer-schedule-toolbar.js';\n  const from = \`>\${'\${escapeHtml(department.name)}'}</option>\`;\n  const to = \`>\${'\${escapeHtml(getLocalizedName(department))}'}</option>\`;\n  const source = read(path);\n  const count = source.split(from).length - 1;\n  if (count !== 2) throw new Error(\`\${path}: expected exactly 2 department option names, found \${count}\`);\n  write(path, source.replaceAll(from, to));\n}`;
if (!source.includes(oldBlock)) throw new Error('target schedule-toolbar migration block not found');
source = source.replace(oldBlock, newBlock);
fs.writeFileSync(path, source, 'utf8');
console.log('temporary migration script repaired');
