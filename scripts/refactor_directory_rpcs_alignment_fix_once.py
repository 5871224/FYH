from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts" / "check-v2-alignment.js"
content = path.read_text(encoding="utf-8-sig")
old = '''const sourceApi = read("src/renderer/v2-api.js");
assert(sourceApi.includes("safeDepartmentColumns"), "Safe department projection is missing");
assert(sourceApi.includes("runManagerSafeWrite"), "Manager-safe department write wrapper is missing");
const sourceJs = read("src/renderer/app.js");
const docsJs = read("docs/app.js");
assert(sourceJs === docsJs, "src/renderer/app.js and docs/app.js are not synchronized");
assert(sourceJs.includes("safeDepartmentColumns") && sourceJs.includes("runManagerSafeWrite"), "JavaScript bundle is missing V2 API protections");'''
new = '''const sourceApi = read("src/renderer/v2-api.js");
const sourceWebApi = read("src/renderer/web-api.js");
assert(!sourceApi.includes("safeDepartmentColumns") && !sourceApi.includes("runManagerSafeWrite") && !sourceApi.includes("managerSafeFetch"), "Front-end still uses fetch interception as a permission boundary");
assert(sourceWebApi.includes("get_my_profile_v2") && sourceWebApi.includes("get_schedule_directory_v2") && sourceWebApi.includes("get_employee_admin_directory_v2"), "Purpose-specific employee RPCs are missing from the web API");
assert(!sourceWebApi.includes("get_employee_directory_v2"), "Retired mixed-purpose employee RPC is still used by the web API");
const sourceJs = read("src/renderer/app.js");
const docsJs = read("docs/app.js");
assert(sourceJs === docsJs, "src/renderer/app.js and docs/app.js are not synchronized");
assert(sourceJs.includes("get_my_profile_v2") && sourceJs.includes("get_schedule_directory_v2") && sourceJs.includes("get_employee_admin_directory_v2"), "JavaScript bundle is missing purpose-specific employee RPCs");'''
if old not in content:
    if new not in content:
        raise RuntimeError("找不到舊的 V2 alignment 權限檢查")
else:
    content = content.replace(old, new, 1)
path.write_text(content, encoding="utf-8")
print("alignment checks updated")
