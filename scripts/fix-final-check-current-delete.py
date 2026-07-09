from pathlib import Path

path = Path("scripts/check-v2-final.js")
text = path.read_text(encoding="utf-8")

old_delete = '''assert(memberDelete.includes('rpc("has_synchronized_member_delete_v2")'), "刪除前未確認同步刪除 migration");
assert(memberDelete.includes("auth.admin.deleteUser(target.id)"), "帳號刪除未由 Auth 端啟動級聯交易");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在先刪人員資料再刪 Auth 的不同步流程");'''
new_delete = '''assert(memberDelete.includes('rpc("delete_member_account_v3"'), "帳號刪除未使用交易 RPC");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在前端直接刪除人員資料的不同步流程");'''
if old_delete in text:
    text = text.replace(old_delete, new_delete, 1)
elif new_delete not in text:
    raise SystemExit("member-delete assertions not found")

old_width = 'assert(sourceMeal.includes("width: min(1100px, 100%)"), "電腦版訂餐頁寬度未與記錄頁一致");'
new_width = '''const sourceUiSystem = read("src/renderer/ui-system.css");
const publishedUiSystem = read("docs/ui-system.css");
assert(sourceUiSystem === publishedUiSystem, "共用介面樣式來源版與發布版不同步");
assert(sourceUiSystem.includes(".meal-card") && sourceUiSystem.includes("width: min(1100px, 100%)"), "電腦版訂餐頁寬度未與記錄頁一致");'''
if old_width in text:
    text = text.replace(old_width, new_width, 1)
elif new_width not in text:
    raise SystemExit("meal width assertion not found")

path.write_text(text, encoding="utf-8")
