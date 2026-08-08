from pathlib import Path
import shutil

r = Path('src/renderer')

# Browser: one canonical member-admin Edge Function for create/update/reset/delete.
p = r / 'web-api.js'
t = p.read_text(encoding='utf-8')
t = t.replace(',\n      defaultPassword: "0000"', '')
old = '''  async function deleteMemberProfile(employeeCode, currentPassword = "") {
    ensureManager();
    return requestFunction("member-delete-v2", {
      employeeCode: String(employeeCode || "").trim(),
      currentPassword: String(currentPassword || "")
    });
  }'''
new = '''  async function deleteMemberProfile(employeeCode, currentPassword = "") {
    ensureManager();
    return requestFunction("member-auth-admin", {
      action: "delete_member",
      employeeCode: String(employeeCode || "").trim(),
      currentPassword: String(currentPassword || "")
    });
  }'''
if old not in t:
    raise RuntimeError('deleteMemberProfile legacy function not found')
t = t.replace(old, new, 1)
p.write_text(t, encoding='utf-8')

# Member auth admin keeps self-delete password verification inside the same canonical endpoint.
p = Path('supabase/functions/member-auth-admin/index.ts')
t = p.read_text(encoding='utf-8')
marker = 'async function deleteMember(ctx: any, body: any) {'
if marker not in t:
    raise RuntimeError('deleteMember marker missing')
verify = '''async function verifyCurrentPassword(employeeCode: string, password: string) {
  if (!password) throw new Error("刪除自己的帳號前，請輸入目前密碼");
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anonKey) throw new Error("伺服器缺少登入驗證設定");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: buildLoginEmail(employeeCode), password })
  });
  if (!response.ok) throw new Error("目前密碼不正確");
}

'''
if 'async function verifyCurrentPassword' not in t:
    t = t.replace(marker, verify + marker, 1)
old_block = '''  const profile = await findProfileByCode(ctx, employeeCode);
  if (!profile?.id || profile.deleted_at) return { ok: true, deleted: false, softDeleted: false };
  await assertActorMayManageTarget(ctx, actor, profile);
  if (await roleHasPrivilegedPermission(ctx, profile.access_role_id) && await countEffectivePrivilegedAccounts(ctx) <= 1) {'''
new_block = '''  const profile = await findProfileByCode(ctx, employeeCode);
  if (!profile?.id || profile.deleted_at) return { ok: true, deleted: false, softDeleted: false };
  await assertActorMayManageTarget(ctx, actor, profile);
  const selfDelete = profile.id === actor.actorId;
  if (selfDelete) await verifyCurrentPassword(profile.employee_code, String(body?.currentPassword || ""));
  if (await roleHasPrivilegedPermission(ctx, profile.access_role_id) && await countEffectivePrivilegedAccounts(ctx) <= 1) {'''
if old_block not in t:
    raise RuntimeError('delete member authorization block not found')
t = t.replace(old_block, new_block, 1)
t = t.replace('  return { ...result, employeeCode };\n}', '  return { ...result, selfDelete, employeeCode };\n}', 1)
p.write_text(t, encoding='utf-8')

# Remove obsolete duplicate Edge APIs; all their operations now have named RPC / member-auth-admin owners.
for dirname in ['supabase/functions/member-delete-v2', 'supabase/functions/catalog-admin']:
    path = Path(dirname)
    if path.exists(): shutil.rmtree(path)

# Deployment manifest must only deploy canonical Edge Functions.
p = Path('scripts/deploy-edge-functions.ps1')
t = p.read_text(encoding='utf-8')
t = t.replace('  "member-delete-v2",\n', '')
t = t.replace('  "catalog-admin",\n', '')
p.write_text(t, encoding='utf-8')

print('member/catalog Edge API consolidation complete')
