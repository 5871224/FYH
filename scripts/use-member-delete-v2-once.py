from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "renderer" / "web-api.js"
text = path.read_text(encoding="utf-8")
old = '''  async function deleteMemberProfile(employeeCode) {
    ensureManager();
    return requestFunction("member-auth-admin", {
      action: "delete_member",
      employeeCode: String(employeeCode || "").trim()
    });
  }'''
new = '''  async function deleteMemberProfile(employeeCode) {
    ensureManager();
    return requestFunction("member-delete-v2", {
      employeeCode: String(employeeCode || "").trim()
    });
  }'''
if old not in text and new not in text:
    raise RuntimeError("找不到人員刪除 API")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
