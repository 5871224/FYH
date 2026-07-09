from pathlib import Path

path = Path("scripts/check-v2-final.js")
text = path.read_text(encoding="utf-8")
line = 'assert(sourceWebApi.includes("get_employee_directory_v2") && sourceWebApi.includes("get_department_directory_v2"), "前端尚未改用安全名錄 RPC");\n'
text = text.replace(line, "")
marker = 'const sourceWebApi = read("src/renderer/web-api.js");\n'
if marker not in text:
    raise SystemExit("sourceWebApi declaration not found")
text = text.replace(marker, marker + line, 1)
path.write_text(text, encoding="utf-8")
