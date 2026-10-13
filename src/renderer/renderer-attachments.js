/* 簽到附件共用介面與操作。正式檔案權限一律由 attendance-attachments Edge Function 驗證。 */
let pendingAttendanceFiles=[];
let attachmentWorkDate="";
function ensureAttachmentState(){
  ensureRecordsState();
  recordsState.attachmentCounts ||= {};
  recordsState.attachmentManager ||= {
    loaded:false,loading:false,rows:[],total:0,page:1,pageSize:50,usage:{usedBytes:0,limitBytes:21474836480},
    filters:{fromDate:addDaysToDateString(getTodayDateString(),-30),toDate:getTodayDateString()},error:""
  };
  return recordsState.attachmentManager;
}
function attachmentOwner(){return window.schedulerApi.getAuthContext()?.session?.user?.id||"";}
function attachmentSize(bytes){
  const n=Number(bytes)||0;
  return n>=1073741824?(n/1073741824).toFixed(2)+" GB"
    :n>=1048576?(n/1048576).toFixed(2)+" MB":(n/1024).toFixed(1)+" KB";
}
function attachmentIcon(kind){
  return kind==="upload"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 17v3h16v-3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 11.5-8.5 8.5a6 6 0 0 1-8.5-8.5L13 2.5a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.4-8.4"/></svg>';
}
function renderAttachmentCell(owner,date,editable){
  ensureAttachmentState();
  const count=recordsState.attachmentCounts[owner+":"+date]||0;
  return '<span class="attachment-cell">'
    +(editable?'<button class="settings-icon-btn attachment-icon-btn" type="button" title="上傳檔案" aria-label="上傳檔案" data-att-upload="'+escapeHtml(date)+'">'+attachmentIcon("upload")+'</button>':"")
    +(count?'<button class="settings-icon-btn attachment-icon-btn" type="button" title="查看附件" aria-label="查看附件" data-att-day="'+escapeHtml(owner+":"+date)+'">'+attachmentIcon("clip")+'<sup>'+count+'</sup></button>':"")
    +'</span>';
}
async function refreshAttachmentCounts(rows,personal){
  const owner=attachmentOwner();
  const days=(rows||[]).map(x=>({ownerId:personal?owner:x.user_id,date:personal?x.date:x.work_date})).filter(x=>x.ownerId&&x.date);
  if(!days.length)return;
  try{
    const r=await window.schedulerApi.getAttachmentCounts(days);
    ensureAttachmentState();
    for(const x of days)recordsState.attachmentCounts[x.ownerId+":"+x.date]=r.counts?.[x.ownerId+":"+x.date]||0;
  }catch(error){console.warn("附件數量載入失敗",error);}
}
async function loadAttachmentManager(render=true){
  if(!hasAnyGroupPermission("attendance_review"))return;
  const s=ensureAttachmentState();s.loading=true;s.error="";
  if(render)renderAll();
  try{
    const r=await window.schedulerApi.getAttachmentManager({...s.filters,page:s.page});
    Object.assign(s,{...r,loaded:true,loading:false,error:""});
  }catch(error){s.loading=false;s.error=error.message||"附件清單載入失敗";}
  if(render)renderAll();
}
function renderAttachmentManager(){
  const s=ensureAttachmentState(),u=s.usage||{},bytes=Number(u.usedBytes)||0,limit=Number(u.limitBytes)||21474836480;
  const pct=Math.min(100,bytes/limit*100);
  return '<section class="records-section attachment-manager">'
    +'<div class="attachment-usage"><div><b>附件儲存用量</b><span>'+attachmentSize(bytes)+' / '+attachmentSize(limit)+'（'+pct.toFixed(1)+'%）</span></div>'
    +'<div class="attachment-progress" role="progressbar" aria-valuenow="'+Math.round(pct)+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+pct+'%;background:'+(pct>=90?'#b44b41':pct>=80?'#bb891d':'#4387ba')+'"></span></div>'
    +'<small>剩餘 '+attachmentSize(Math.max(0,limit-bytes))+'</small></div>'
    +'<div class="records-admin-toolbar"><div class="records-admin-filters attachment-manager-filters">'
    +'<label class="records-admin-field"><span>開始日期</span><input type="date" value="'+escapeHtml(s.filters.fromDate)+'" data-att-filter="fromDate"></label>'
    +'<label class="records-admin-field"><span>結束日期</span><input type="date" value="'+escapeHtml(s.filters.toDate)+'" data-att-filter="toDate"></label>'
    +'</div><div class="records-admin-actions"><button type="button" class="ghost-btn compact-btn" data-att-batch>整批刪除</button></div></div>'
    +(s.error?'<p class="auth-error">'+escapeHtml(s.error)+'</p>':'')
    +'<div class="records-table-wrap"><table class="records-table attachment-manager-table"><thead><tr>'
    +'<th><input type="checkbox" data-att-check-all aria-label="全選本頁"></th><th>日期</th><th>員工</th><th>檔案</th><th>大小</th><th>操作</th></tr></thead><tbody>'
    +(s.rows||[]).map(r=>'<tr><td><input type="checkbox" data-att-check="'+escapeHtml(r.id)+'"></td><td>'+renderRecordDateCell(r.work_date)+'</td><td>'+escapeHtml(r.employee_name)+'</td><td title="'+escapeHtml(r.description||"")+'">'+escapeHtml(r.original_name)+'</td><td>'+attachmentSize(r.size_bytes)+'</td><td><button class="ghost-btn compact-btn" data-att-view="'+escapeHtml(r.id)+'">查看</button> <button class="ghost-btn compact-btn" data-att-delete="'+escapeHtml(r.id)+'">刪除</button></td></tr>').join("")
    +(!(s.rows||[]).length?'<tr><td colspan="6">沒有檔案</td></tr>':"")+'</tbody></table></div>'
    +'<div class="records-filter-row records-pagination"><button class="ghost-btn compact-btn" data-att-page="'+(s.page-1)+'" '+(s.page<=1?'disabled':'')+'>上一頁</button>'
    +'<span>共 '+s.total+' 筆，第 '+s.page+' / '+Math.max(1,Math.ceil(s.total/s.pageSize))+' 頁</span>'
    +'<button class="ghost-btn compact-btn" data-att-page="'+(s.page+1)+'" '+(s.page*s.pageSize>=s.total?'disabled':'')+'>下一頁</button></div>'
    +(s.loading?'<p>載入中...</p>':'')+'</section>';
}
function updateAttachmentPending(){
  const list=document.getElementById("attachmentPendingFiles");if(!list)return;
  list.innerHTML=pendingAttendanceFiles.map((f,i)=>'<div class="attachment-pending-row"><span>'+escapeHtml(f.name)+'（'+attachmentSize(f.size)+'）</span><button type="button" class="ghost-btn compact-btn" data-att-remove="'+i+'">移除</button></div>').join("")||'<span>尚未選擇檔案</span>';
}
function addAttachmentFiles(files){
  const added=[...(files||[])];
  if(pendingAttendanceFiles.length+added.length>5){showInfoMessage("每次最多上傳五個檔案");return;}
  if(added.some(f=>!f.size||f.size>10485760)){showInfoMessage("單檔大小不可超過 10 MB");return;}
  pendingAttendanceFiles.push(...added);updateAttachmentPending();
}
function openAttachmentUpload(date){
  const record=(recordsState.personal||[]).find(x=>x.date===date);
  if(!record||record.reviewed||record.editable===false){showInfoMessage("該日期已審核或不能修改");return;}
  attachmentWorkDate=date;pendingAttendanceFiles=[];
  openEntityListModal({title:"上傳附件｜"+date,body:
    '<div class="attachment-form"><label class="form-row">說明（選填）<textarea id="attachmentDesc" maxlength="1000" rows="2"></textarea></label>'
    +'<div class="attachment-picker"><button class="ghost-btn" type="button" data-att-camera>拍照</button><button class="ghost-btn" type="button" data-att-choose>選擇檔案（可多選）</button></div>'
    +'<input id="attachmentCamera" type="file" accept="image/*" capture="environment" hidden>'
    +'<input id="attachmentFiles" type="file" multiple accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip" hidden>'
    +'<div class="attachment-drop" id="attachmentDrop">也可以將檔案拖曳至此</div><div id="attachmentPendingFiles">尚未選擇檔案</div><p id="attachmentStatus"></p></div>',
    footerButtons:'<button class="btn-cancel" type="button" data-close-button="true">取消</button><button class="btn-primary" type="button" data-att-submit>送出</button>'
  });
}
async function saveAttachmentUpload(){
  if(!pendingAttendanceFiles.length){showInfoMessage("請先選擇檔案");return;}
  const button=document.querySelector("[data-att-submit]");
  const status=document.getElementById("attachmentStatus");if(button)button.disabled=true;
  let count=0;try{
    for(const f of pendingAttendanceFiles){
      if(status)status.textContent="正在上傳 "+(count+1)+" / "+pendingAttendanceFiles.length+"："+f.name;
      await window.schedulerApi.uploadAttendanceAttachment(attachmentWorkDate,document.getElementById("attachmentDesc")?.value||"",f);count++;
    }
    closeModal();showInfoMessage("上傳完成，共 "+count+" 個附件");
  }catch(error){
    if(status)status.textContent="已成功 "+count+" 個，上傳中斷："+error.message;
    pendingAttendanceFiles=pendingAttendanceFiles.slice(count);updateAttachmentPending();
  }finally{
    if(button?.isConnected)button.disabled=false;
    await loadRecordsPage(false);renderAll();
  }
}
async function openAttachmentDay(owner,date){
  try{
    const r=await window.schedulerApi.getAttachmentDay(owner,date);
    const record=(recordsState.personal||[]).find(x=>x.date===date);
    const editable=owner===attachmentOwner()&&record&&!record.reviewed&&record.editable!==false;
    openEntityListModal({title:"附檔｜"+date,body:'<div class="attachment-day-list">'
      +(r.rows||[]).map(f=>'<div class="attachment-day-row"><b>'+escapeHtml(f.original_name)+'</b><small>'+attachmentSize(f.size_bytes)+'</small>'
      +(editable?'<input type="text" maxlength="1000" aria-label="說明" value="'+escapeHtml(f.description||"")+'" data-att-description="'+escapeHtml(f.id)+'">':'<span>'+escapeHtml(f.description||"")+'</span>')
      +'<div><button class="ghost-btn compact-btn" data-att-view="'+escapeHtml(f.id)+'">查看／下載</button>'
      +(editable?'<button class="ghost-btn compact-btn" data-att-save="'+escapeHtml(f.id)+'">儲存說明</button><button class="ghost-btn compact-btn" data-att-delete="'+escapeHtml(f.id)+'">刪除</button>':'')+'</div></div>').join("")
      +(!(r.rows||[]).length?'<p>沒有附件</p>':'')+'</div>'});
  }catch(error){showInfoMessage(error.message);}
}
async function openAttachmentPreview(id){
  try{
    const r=await window.schedulerApi.getAttachmentView(id);
    if(/^image\/(jpeg|png|webp|gif)$/.test(r.mime)){
      openEntityListModal({title:r.name,body:'<div class="attachment-preview"><img alt="'+escapeHtml(r.name)+'" src="'+escapeHtml(r.url)+'"></div>'});
    }else{
      const a=document.createElement("a");a.href=r.url;a.download=r.name;a.rel="noopener";document.body.appendChild(a);a.click();a.remove();
    }
  }catch(error){showInfoMessage(error.message);}
}
async function removeAttachments(ids){
  if(!ids.length){showInfoMessage("請勾選檔案");return;}
  const s=ensureAttachmentState(),bytes=(s.rows||[]).filter(x=>ids.includes(x.id)).reduce((n,x)=>n+Number(x.size_bytes),0);
  if(!await confirmAction("確定要刪除 "+ids.length+" 個檔案（"+attachmentSize(bytes)+"）嗎？此操作無法復原。"))return;
  try{
    const r=await window.schedulerApi.deleteAttendanceAttachments(ids),failed=(r.results||[]).filter(x=>!x.ok);
    showInfoMessage(failed.length?"有 "+failed.length+" 個刪除失敗："+failed.map(x=>x.error).join("；"):"附件已刪除");
    closeModal();
    await Promise.all([loadRecordsPage(false),loadAttachmentManager(false),...(ensureAttendanceReviewState().loaded?[loadAttendanceReview(false)]:[])]);
    renderAll();
  }catch(error){showInfoMessage(error.message);}
}
function bindAttachmentEvents(){
  document.addEventListener("change",e=>{
    const t=e.target;
    if(t?.id==="attachmentCamera"||t?.id==="attachmentFiles"){addAttachmentFiles(t.files);t.value="";}
    if(t?.dataset?.attFilter){const s=ensureAttachmentState();s.filters[t.dataset.attFilter]=t.value;s.page=1;void loadAttachmentManager();}
    if(t?.dataset?.attCheckAll!==undefined)document.querySelectorAll("[data-att-check]").forEach(x=>x.checked=t.checked);
  });
  document.addEventListener("dragover",e=>{if(e.target.closest?.("#attachmentDrop"))e.preventDefault();});
  document.addEventListener("drop",e=>{if(e.target.closest?.("#attachmentDrop")){e.preventDefault();addAttachmentFiles(e.dataTransfer.files);}});
  document.addEventListener("click",async e=>{
    const t=e.target.closest("button");if(!t)return;
    if(t.dataset.attUpload){openAttachmentUpload(t.dataset.attUpload);return;}
    if(t.dataset.attDay){const [owner,date]=t.dataset.attDay.split(":");await openAttachmentDay(owner,date);return;}
    if(t.dataset.attCamera!==undefined){document.getElementById("attachmentCamera")?.click();return;}
    if(t.dataset.attChoose!==undefined){document.getElementById("attachmentFiles")?.click();return;}
    if(t.dataset.attRemove!==undefined){pendingAttendanceFiles.splice(Number(t.dataset.attRemove),1);updateAttachmentPending();return;}
    if(t.dataset.attSubmit!==undefined){await saveAttachmentUpload();return;}
    if(t.dataset.attView){await openAttachmentPreview(t.dataset.attView);return;}
    if(t.dataset.attDelete){await removeAttachments([t.dataset.attDelete]);return;}
    if(t.dataset.attBatch!==undefined){await removeAttachments([...document.querySelectorAll("[data-att-check]:checked")].map(x=>x.dataset.attCheck));return;}
    if(t.dataset.attPage){const s=ensureAttachmentState();s.page=Number(t.dataset.attPage);if(s.page>0)await loadAttachmentManager();return;}
    if(t.dataset.attSave){const input=[...document.querySelectorAll("[data-att-description]")].find(x=>x.dataset.attDescription===t.dataset.attSave);
      try{await window.schedulerApi.editAttendanceAttachment(t.dataset.attSave,input?.value||"");showInfoMessage("說明已儲存");}catch(error){showInfoMessage(error.message);}return;}
  });
}
