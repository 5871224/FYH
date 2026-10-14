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
  assert.match(dialogs[0].headerButtons,/data-att-save-all/);
  assert.equal(dialogs[0].hideFooterClose,true);
  assert.equal(dialogs[0].suppressCloseTooltip,true);
  assert.equal((dialogs[0].body.match(/data-att-view=/g)||[]).length,2);
  assert.equal((dialogs[0].body.match(/data-att-description=/g)||[]).length,2);
  permitted=false;
  await ctx.openAttachmentDay("owner-aaa","2026-10-13");
  assert.doesNotMatch(dialogs[1].body,/data-att-delete=/);
  assert.ok(!dialogs[1].headerButtons);
  assert.doesNotMatch(dialogs[1].body,/data-att-description=/);
  assert.equal((dialogs[1].body.match(/data-att-view=/g)||[]).length,2);
});


test("附檔管理列表顯示說明，查看與刪除都用 SVG 圖示按鈕",()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const ctx={
    recordsState:{attachmentCounts:{},attachmentManager:{
      loaded:true,loading:false,total:1,page:1,pageSize:50,
      filters:{fromDate:"2026-10-01",toDate:"2026-10-31"},
      usage:{usedBytes:1000,limitBytes:21474836480},
      rows:[{id:"photo-1",work_date:"2026-10-13",employee_name:"AAA",
        original_name:"LINE_NOTE.jpg",description:"測試說明",size_bytes:259000}]
    }},
    ensureRecordsState(){},
    getTodayDateString(){return "2026-10-13";},
    addDaysToDateString(){return "2026-09-13";},
    escapeHtml:v=>String(v),
    renderRecordDateCell:v=>v
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  const html=ctx.renderAttachmentManager();
  assert.match(html,/<th>說明<\/th>/);
  assert.match(html,/測試說明/);
  assert.match(html,/data-att-view="photo-1"/);
  assert.match(html,/data-att-delete="photo-1"/);
  assert.equal((html.match(/<svg/g)||[]).length,2);
  assert.doesNotMatch(html,/>查看<\/button>|>刪除<\/button>/);
});

test("標題儲存鈕一次儲存所有已修改說明，並略過未變更檔案",async()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const saved=[],messages=[];
  let closed=0;
  const inputs=[
    {value:"新說明A",dataset:{attDescription:"f1",attOriginalDescription:"舊說明A"}},
    {value:"沒變更",dataset:{attDescription:"f2",attOriginalDescription:"沒變更"}},
    {value:"新說明C",dataset:{attDescription:"f3",attOriginalDescription:"舊說明C"}}
  ];
  const ctx={
    document:{querySelectorAll:()=>inputs},
    window:{schedulerApi:{editAttendanceAttachment:async (id,text)=>{saved.push([id,text]);}}},
    showInfoMessage:m=>messages.push(m),
    closeModal:()=>{closed++;}
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  const button={disabled:false,isConnected:true};
  await ctx.saveAttachmentDayDescriptions(button);
  assert.deepEqual(saved.map(([id,text])=>`${id}:${text}`),["f1:新說明A","f3:新說明C"]);
  assert.equal(inputs[0].dataset.attOriginalDescription,"新說明A");
  assert.equal(inputs[2].dataset.attOriginalDescription,"新說明C");
  assert.equal(button.disabled,false);
  assert.deepEqual(messages,[]);
  assert.equal(closed,1);
});

test("批次儲存若某筆失敗，保留未成功的修改供重試",async()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const input={value:"準備重試",dataset:{attDescription:"f1",attOriginalDescription:"舊說明"},closest:()=>({querySelector:()=>({textContent:"x.jpg"})})};
  const messages=[];
  const ctx={
    document:{querySelectorAll:()=>[input]},
    window:{schedulerApi:{editAttendanceAttachment:async()=>{throw new Error("審核狀態已變更");}}},
    showInfoMessage:m=>messages.push(m)
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  await ctx.saveAttachmentDayDescriptions({disabled:false,isConnected:true});
  assert.equal(input.dataset.attOriginalDescription,"舊說明");
  assert.match(messages[0],/失敗/);
  assert.match(messages[0],/x\.jpg/);
});


test("說明未修改時儲存直接關閉，不跳確認提示",async()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const notices=[],saved=[];
  let closed=0;
  const ctx={
    document:{querySelectorAll:()=>[{value:"未變更",dataset:{attDescription:"f1",attOriginalDescription:"未變更"}}]},
    window:{schedulerApi:{editAttendanceAttachment:async(...args)=>saved.push(args)}},
    showInfoMessage:m=>notices.push(m),
    closeModal:()=>{closed++;}
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  await ctx.saveAttachmentDayDescriptions({disabled:false,isConnected:true});
  assert.equal(closed,1);
  assert.equal(saved.length,0);
  assert.equal(notices.length,0);
});

test("附件 SVG 不使用滑鼠 title 提示，同時保留 aria-label",()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const ctx={
    recordsState:{attachmentCounts:{}},
    ensureRecordsState(){},
    getTodayDateString(){return "2026-10-13";},
    addDaysToDateString(){return "2026-09-13";},
    escapeHtml:s=>String(s)
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  const markup=[ctx.attachmentActionButton("view","f1"),ctx.attachmentActionButton("delete","f1"),
    ctx.renderAttachmentCell("person","2026-10-13",true,2)].join("");
  assert.doesNotMatch(markup,/\stitle=/);
  assert.match(markup,/aria-label="查看／下載"/);
  assert.match(markup,/aria-label="刪除"/);
  assert.match(markup,/aria-label="上傳檔案"/);
  assert.match(markup,/aria-label="查看附件"/);
});


test("放大鏡照片預覽視窗只有右上角 X，不建立底部關閉按鈕",async()=>{
  const vm=require("node:vm");
  const src=read("src/renderer/renderer-attachments.js");
  const dialogs=[];
  const ctx={
    window:{schedulerApi:{getAttachmentView:async id=>({name:"照片.jpg",mime:"image/jpeg",url:"https://example.invalid/private-image"})}},
    escapeHtml:value=>String(value),
    openEntityListModal:config=>dialogs.push(config),
    showInfoMessage:message=>{throw new Error(message);}
  };
  vm.runInNewContext(src,ctx,{timeout:2000});
  await ctx.openAttachmentPreview("file-1");
  assert.equal(dialogs.length,1);
  assert.equal(dialogs[0].hideFooterClose,true);
  assert.equal(dialogs[0].suppressCloseTooltip,true);
  assert.match(dialogs[0].body,/<img /);
  assert.equal(dialogs[0].footerButtons,undefined);
});


test("上傳附件標題右側是主要按鈕「存檔」，底部沒有關閉、取消或送出按鈕",()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const dialogs=[];
  const context={
    recordsState:{personal:[{date:"2026-10-13",reviewed:false,editable:true}]},
    openEntityListModal:dialog=>dialogs.push(dialog),
    showInfoMessage:()=>{throw new Error("不應阻擋上傳")},
  };
  vm.runInNewContext(source,context,{timeout:2000});
  context.openAttachmentUpload("2026-10-13");
  assert.equal(dialogs.length,1);
  const dialog=dialogs[0];
  assert.equal(dialog.hideFooterClose,true);
  assert.equal(dialog.suppressCloseTooltip,true);
  assert.equal(dialog.footerButtons,undefined);
  assert.match(dialog.headerButtons,/class="btn-primary"[^>]*data-att-submit>存檔<\/button>/);
  assert.match(dialog.body,/data-att-camera/);
  assert.match(dialog.body,/data-att-choose/);
  assert.match(dialog.body,/id="attachmentDrop"/);
  assert.doesNotMatch(dialog.body,/data-att-submit|>取消<\/button>|>送出<\/button>/);
});


test("選取與拖曳時即排除不支援格式，TXT 仍允許，顯示拒絕原因",()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const status={textContent:""};
  const list={innerHTML:""};
  const ctx={
    document:{getElementById:id=>id==="attachmentStatus"?status:id==="attachmentPendingFiles"?list:null},
    window:{},
    escapeHtml:v=>String(v),attachmentSize:v=>String(v)+" B"
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  const attachments=[
    {name:"1c.ico",size:38400,type:"image/vnd.microsoft.icon"},
    {name:"License.txt",size:5600,type:"text/plain"},
    {name:"proof.JPG",size:1500,type:"image/jpeg"},
    {name:"oversized.pdf",size:10485761,type:"application/pdf"}
  ];
  ctx.addAttachmentFiles(attachments);
  assert.match(list.innerHTML,/License\.txt/);
  assert.match(list.innerHTML,/proof\.JPG/);
  assert.doesNotMatch(list.innerHTML,/1c\.ico|oversized\.pdf/);
  assert.match(status.textContent,/1c\.ico（格式不支援）/);
  assert.match(status.textContent,/oversized\.pdf（檔案必須介於/);
  assert.equal(ctx.attachmentFileIssue(attachments[0]),"格式不支援");
  assert.equal(ctx.attachmentFileIssue(attachments[1]),"");
  assert.equal(ctx.attachmentFileIssue({name:"no-extension",size:500}),"格式不支援");
});

test("選取器 accept 及後端副檔名白名單與前端一致",()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const edge=read("supabase/functions/attendance-attachments/index.ts");
  const ctx={};
  vm.runInNewContext(source+'\n;globalThis.__allowedExtensions=attachmentAllowedExtensions;globalThis.__acceptedTypes=attachmentAcceptedTypes;',ctx,{timeout:2000});
  const front=[...ctx.__allowedExtensions].sort();
  const match=edge.match(/const allowedExtensions=\[([^\]]+)\]/);
  assert.ok(match,"後端應有副檔名白名單");
  const backend=[...match[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]).sort();
  assert.deepEqual(front,backend);
  assert.match(source,/accept="'\+attachmentAcceptedTypes\+'/);
  assert.doesNotMatch(ctx.__acceptedTypes,/\.ico|image\/\*/);
});

test("多選超過五檔時僅保留合格且不超額的檔案",()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const status={textContent:""},list={innerHTML:""};
  const ctx={
    document:{getElementById:id=>id==="attachmentStatus"?status:id==="attachmentPendingFiles"?list:null},
    window:{},
    escapeHtml:v=>String(v),attachmentSize:v=>String(v)+" B"
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  ctx.addAttachmentFiles(Array.from({length:7},(_,i)=>({name:"photo"+i+".jpg",size:1000})));
  const selected=(list.innerHTML.match(/class="attachment-pending-row"/g)||[]).length;
  assert.equal(selected,5);
  assert.match(status.textContent,/每次最多五個檔案/);
});


test("從附檔清單查看圖片時，右上角 X 返回原附檔視窗並保留尚未儲存的說明",async()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const input={value:"尚未存檔的說明"};
  const original={querySelector:()=>({}),input,scrollTop:175};
  const closeBtn={
    dataset:{closeButton:"true"},
    setAttribute(name,value){this[name]=value;}
  };
  const preview={querySelector:selector=>selector.includes("modal-close-btn")?closeBtn:null};
  const root={
    firstElementChild:original,
    querySelector:selector=>selector===".attachment-day-list"?{}:selector.includes("modal-close-btn")?closeBtn:null,
    replaceChildren(node){this.firstElementChild=node;}
  };
  const ctx={
    document:{getElementById:id=>id==="modalRoot"?root:null},
    modalContext:{category:"existing-dialog"},
    window:{schedulerApi:{getAttachmentView:async()=>({name:"a.jpg",mime:"image/jpeg",url:"https://example.invalid/a.jpg"})}},
    escapeHtml:s=>String(s),
    openEntityListModal:()=>{root.firstElementChild=preview;},
    showInfoMessage:message=>{throw Error(message);}
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  await ctx.openAttachmentPreview("file-1");
  assert.equal(closeBtn.dataset.closeButton,undefined);
  assert.equal(closeBtn.dataset.attPreviewBack,"");
  assert.equal(closeBtn["aria-label"],"返回附檔");
  assert.equal(root.firstElementChild,preview);
  ctx.restoreAttachmentPreviewOrigin();
  assert.equal(root.firstElementChild,original);
  assert.equal(root.firstElementChild.input.value,"尚未存檔的說明");
  assert.equal(root.firstElementChild.scrollTop,175);
  assert.equal(ctx.modalContext.category,"existing-dialog");
});

test("從附檔管理直接查看圖片時，X 保持一般關閉行為",async()=>{
  const vm=require("node:vm");
  const source=read("src/renderer/renderer-attachments.js");
  const closeBtn={dataset:{closeButton:"true"}};
  const root={
    firstElementChild:null,
    querySelector:selector=>selector===".attachment-day-list"?null:closeBtn
  };
  const ctx={
    document:{getElementById:id=>id==="modalRoot"?root:null},
    window:{schedulerApi:{getAttachmentView:async()=>({name:"a.jpg",mime:"image/jpeg",url:"https://example.invalid/a.jpg"})}},
    escapeHtml:s=>String(s),
    openEntityListModal:()=>{root.firstElementChild={};},
    showInfoMessage:message=>{throw Error(message);}
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  await ctx.openAttachmentPreview("file-1");
  assert.equal(closeBtn.dataset.closeButton,"true");
  assert.equal(closeBtn.dataset.attPreviewBack,undefined);
});
