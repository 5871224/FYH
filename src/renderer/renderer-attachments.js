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
  if(kind==="upload")return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 17v3h16v-3"/></svg>';
  if(kind==="clip")return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 11.5-8.5 8.5a6 6 0 0 1-8.5-8.5L13 2.5a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.4-8.4"/></svg>';
  if(kind==="view")return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.2"/><path d="m15.4 15.4 5.2 5.2"/></svg>';
  if(kind==="delete")return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6"/></svg>';
  return "";
}
function attachmentActionButton(action,id){
  const attr=escapeHtml(id);
  if(action==="view")return '<button class="settings-icon-btn attachment-action-btn" type="button" title="查看／下載" aria-label="查看／下載" data-att-view="'+attr+'">'+attachmentIcon("view")+'</button>';
  if(action==="delete")return '<button class="settings-icon-btn attachment-action-btn" type="button" title="刪除" aria-label="刪除" data-att-delete="'+attr+'">'+attachmentIcon("delete")+'</button>';
  return "";
}
function renderAttachmentCell(owner,date,editable,serverCount){
  ensureAttachmentState();
  const count=Number.isInteger(serverCount) && serverCount>=0
    ? serverCount
    : (recordsState.attachmentCounts[owner+":"+date]||0);
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
    +'<th><input type="checkbox" data-att-check-all aria-label="全選本頁"></th><th>日期</th><th>員工</th><th>檔案</th><th>說明</th><th>大小</th><th>操作</th></tr></thead><tbody>'
    +(s.rows||[]).map(r=>'<tr><td><input type="checkbox" data-att-check="'+escapeHtml(r.id)+'"></td><td>'+renderRecordDateCell(r.work_date)+'</td><td>'+escapeHtml(r.employee_name)+'</td><td>'+escapeHtml(r.original_name)+'</td><td class="attachment-manager-description">'+escapeHtml(r.description||"")+'</td><td>'+attachmentSize(r.size_bytes)+'</td><td><div class="attachment-manager-actions">'+attachmentActionButton("view",r.id)+attachmentActionButton("delete",r.id)+'</div></td></tr>').join("")
    +(!(s.rows||[]).length?'<tr><td colspan="7">沒有檔案</td></tr>':"")+'</tbody></table></div>'
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
    closeModal();
    showInfoMessage("已成功上傳 "+count+" 個附件");
  }catch(error){
    const message="已成功 "+count+" 個，上傳中斷："+(error?.message||"未知錯誤");
    if(status)status.textContent=message;
    // 上傳錯誤不能只藏在視窗文字中，員工必須能清楚看到失敗原因。
    showInfoMessage(message);
    pendingAttendanceFiles=pendingAttendanceFiles.slice(count);updateAttachmentPending();
  }finally{
    if(button?.isConnected)button.disabled=false;
    await loadRecordsPage(false);
    // 即使個人紀錄的筆數批次查詢失敗，也要直接讀取當天的附件結果。
    try{
      const result=await window.schedulerApi.getAttachmentDay(attachmentOwner(),attachmentWorkDate);
      ensureAttachmentState();
      recordsState.attachmentCounts[attachmentOwner()+":"+attachmentWorkDate]=(result.rows||[]).length;
    }catch(error){
      console.warn("附件已送出，但同步當日附件數量失敗",error);
      showInfoMessage("附件已送出，更新附檔欄失敗："+(error?.message||"請重新整理頁面"));
    }
    renderAll();
  }
}
async function openAttachmentDay(owner,date){
  try{
    const result=await window.schedulerApi.getAttachmentDay(owner,date);
    // 本人／審核權限由後端驗證，避免依賴個人紀錄的暫存資料。
    const editable=result.canEdit===true;
    const rows=result.rows||[];
    openEntityListModal({
      title:"附檔｜"+date,
      modalClass:"modal modal-wide attachment-day-modal",
      hideFooterClose:true,
      headerButtons:editable&&rows.length
        ?'<button class="btn-primary" type="button" data-att-save-all>儲存</button>'
        :"",
      body:'<div class="attachment-day-list">'
        +rows.map(file=>{
          const id=escapeHtml(file.id);
          return '<div class="attachment-day-row">'
            +'<div class="attachment-file-heading">'
            +'<div class="attachment-file-meta"><strong>'+escapeHtml(file.original_name)+'</strong><small>'+attachmentSize(file.size_bytes)+'</small></div>'
            +'<div class="attachment-file-actions">'+attachmentActionButton("view",file.id)
            +(editable?attachmentActionButton("delete",file.id):"")+'</div></div>'
            +(editable?'<input type="text" maxlength="1000" aria-label="'+escapeHtml(file.original_name)+'的說明" value="'+escapeHtml(file.description||"")+'" data-att-description="'+id+'" data-att-original-description="'+escapeHtml(file.description||"")+'">'
              :'<div class="attachment-file-description">'+escapeHtml(file.description||"")+'</div>')
            +'</div>';
        }).join("")
        +(!rows.length?'<p>沒有附件</p>':"")+'</div>'
    });
  }catch(error){showInfoMessage(error.message||"無法讀取附件");}
}
async function saveAttachmentDayDescriptions(button){
  const inputs=[...document.querySelectorAll("#modalRoot .attachment-day-list [data-att-description]")];
  const updates=inputs.filter(input=>input.value!==input.dataset.attOriginalDescription);
  if(!updates.length){showInfoMessage("附件說明沒有變更");return;}
  if(button)button.disabled=true;
  const failures=[];
  let saved=0;
  try{
    for(const input of updates){
      try{
        await window.schedulerApi.editAttendanceAttachment(input.dataset.attDescription,input.value);
        input.dataset.attOriginalDescription=input.value;
        saved++;
      }catch(error){
        failures.push(input.closest(".attachment-day-row")?.querySelector(".attachment-file-meta strong")?.textContent||input.dataset.attDescription);
      }
    }
    showInfoMessage(failures.length
      ?"已儲存 "+saved+" 個附件說明；以下 "+failures.length+" 個失敗，請重試："+failures.join("、")
      :"已儲存 "+saved+" 個附件說明");
  }finally{
    if(button?.isConnected)button.disabled=false;
  }
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
    if(t.dataset.attSaveAll!==undefined){await saveAttachmentDayDescriptions(t);return;}
  });
}
