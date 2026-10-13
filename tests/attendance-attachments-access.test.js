const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const read = (p) => fs.readFileSync(path.join(root,p),"utf8");

test("隱藏單位管理員仍可依簽到審核權限查看附件，不能對全部使用者放行",()=>{
  const source=read("supabase/functions/attendance-attachments/index.ts");
  assert.match(source,/if\(!isProfileEffective\(found\.data\)\)/);
  assert.match(source,/home_department\?\.hidden_from_schedule\s*&&\s*!await hasAnyGroupPermission\(ctx,id,"attendance_review"\)/);
  assert.match(source,/hasGroupPermission\(ctx,actor\.id,target\.group_id,"attendance_review"\)/);
  assert.match(source,/\.in\("group_id",groupIds\)/);
});

test("上傳成功後直接確認當日的附件數量，失敗必須提示員工",()=>{
  const source=read("src/renderer/renderer-attachments.js");
  assert.match(source,/await window\.schedulerApi\.getAttachmentDay\(attachmentOwner\(\),attachmentWorkDate\)/);
  assert.match(source,/recordsState\.attachmentCounts\[attachmentOwner\(\)\+":"\+attachmentWorkDate\]/);
  assert.match(source,/showInfoMessage\(message\)/);
});

test("檔案僅能經私有 Storage 和配額預留完成上傳",()=>{
  const schema=read("supabase/migrations/2026101301_attendance_attachments.sql");
  assert.match(schema,/false,10485760/);
  assert.match(schema,/pg_advisory_xact_lock/);
  assert.match(schema,/21474836480/);
  const edge=read("supabase/functions/attendance-attachments/index.ts");
  assert.match(edge,/createSignedUploadUrl\(row\.storage_path\)/);
  assert.match(edge,/rpc\("finish_attendance_attachment"/);
});
