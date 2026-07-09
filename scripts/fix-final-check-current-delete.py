from pathlib import Path

path = Path("scripts/check-v2-final.js")
text = path.read_text(encoding="utf-8")
old = '''assert(memberDelete.includes('rpc("has_synchronized_member_delete_v2")'), "刪除前未確認同步刪除 migration");
assert(memberDelete.includes("auth.admin.deleteUser(target.id)"), "帳號刪除未由 Auth 端啟動級聯交易");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在先刪人員資料再刪 Auth 的不同步流程");'''
new = '''assert(memberDelete.includes('rpc("delete_member_account_v3"'), "帳號刪除未使用交易 RPC");
assert(!memberDelete.includes('.from("set_employee").delete()'), "仍存在前端直接刪除人員資料的不同步流程");'''
if old not in text:
    raise SystemExit("member-delete assertions not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
