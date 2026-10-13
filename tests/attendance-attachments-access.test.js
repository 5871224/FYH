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


test("未審附件的編輯權限由伺服器按所有者與審核狀態判斷",()=>{
  const backend=read("supabase/functions/attendance-attachments/index.ts");
  assert.match(backend,/const canEdit=ownerId===actor\.id&&!review\.data\?\.reviewed_at/);
  assert.match(backend,/isProfileEmployedOn\(actor,date\)&&date<=taipeiDateString\(\)/);
  assert.match(backend,/return Response\.json\(\{rows:await rowsForDay\(ctx,ownerId,date\),canEdit\}\)/);
  assert.match(backend,/if\(r\.data\?\.reviewed_at\)throw new Error\("該日期已審核，不能修改附件"\)/);
});

test("本人未審可看到每個檔案的刪除與儲存說明，不依賴已載入個人紀錄",async()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const dialogs=[];
  let permitted=true;
  const ctx={
    recordsState:{personal:[]},
    window:{schedulerApi:{
      getAuthContext:()=>({session:{user:{id:"owner-aaa"}}}),
      getAttachmentDay:async()=>({canEdit:permitted,rows:[
        {id:"file-1",original_name:"photo1.jpg",size_bytes:1024,description:"測試"},
        {id:"file-2",original_name:"photo2.jpg",size_bytes:2048,description:"測試2"}
      ]})
    }},
    escapeHtml:s=>String(s),
    openEntityListModal:dialog=>dialogs.push(dialog),
    showInfoMessage:message=>{throw new Error(message)}
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  await ctx.openAttachmentDay("owner-aaa","2026-10-13");
  assert.equal((dialogs[0].body.match(/data-att-delete=/g)||[]).length,2);
  assert.equal((dialogs[0].body.match(/data-att-save=/g)||[]).length,2);
  permitted=false;
  await ctx.openAttachmentDay("owner-aaa","2026-10-13");
  assert.doesNotMatch(dialogs[1].body,/data-att-delete=/);
  assert.doesNotMatch(dialogs[1].body,/data-att-save=/);
  assert.match(dialogs[1].body,/查看／下載/);
});
