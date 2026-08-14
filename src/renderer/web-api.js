(function installWebSchedulerApi() {
  if (window.schedulerApi) return;

  const config = window.SCHEDULER_CONFIG || {};
  const exporter = window.schedulerBrowserExporter;
  const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/+$/, "");
  const documentId = String(config.documentId || "default");
  if (!exporter) throw new Error("缺少瀏覽器匯出模組");

  let currentSession = null;
  let currentProfile = null;

  async function request(pathname, options = {}) {
    const response = await fetch(`${apiBaseUrl}${pathname}`, {
      method: options.method || "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!response.ok) {
      if (response.status === 401) {
        currentSession = null;
        currentProfile = null;
        window.dispatchEvent(new CustomEvent("scheduler-session-expired"));
      }
      const message = payload?.error?.message || payload?.message || (typeof payload === "string" ? payload : "") || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  function setContext(context) {
    if (!context?.authenticated || !context?.user?.id) {
      currentSession = null;
      currentProfile = null;
      return { session: null, profile: null };
    }
    currentSession = { user: context.user };
    currentProfile = context.profile || null;
    return { session: currentSession, profile: currentProfile };
  }

  async function initializeAuth() {
    try { return setContext(await request("/api/v1/auth/context")); }
    catch (error) {
      currentSession = null;
      currentProfile = null;
      if (/請先登入|登入已失效|HTTP 401/.test(String(error?.message || ""))) return { session: null, profile: null };
      return { session: null, profile: null };
    }
  }
  async function signIn(loginAccount, password) {
    return setContext(await request("/api/v1/auth/sign-in", { method: "POST", body: {
      loginAccount: String(loginAccount || "").trim(), password: String(password || "")
    }}));
  }
  async function signOut() {
    try { await request("/api/v1/auth/sign-out", { method: "POST", body: {} }); } catch {}
    currentSession = null; currentProfile = null;
    return { session: null, profile: null };
  }
  async function changePassword(newPassword) {
    await request("/api/v1/auth/password", { method: "PUT", body: { newPassword: String(newPassword || "") } });
    return { ok: true };
  }
  function ensureSignedIn() { if (!currentSession?.user?.id) throw new Error("請先登入"); }

  function qs(values = {}) {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value) !== "") params.set(key, String(value));
    });
    const text = params.toString();
    return text ? `?${text}` : "";
  }
  function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim()); }
  function nullableDate(value) { const text=String(value||"").trim(); return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null; }
  function nullableTime(value) { const text=String(value||"").trim(); return /^\d{2}:\d{2}$/.test(text)?text:null; }
  function optionalUuid(value,label){const text=String(value||"").trim();if(!text)return null;if(!isUuid(text))throw new Error(`${label}識別碼格式錯誤`);return text;}
  function clampInteger(value,min,max,fallback=min){const n=Number(value);return Number.isInteger(n)?Math.min(max,Math.max(min,n)):fallback;}
  function normalizeTextArray(value){if(Array.isArray(value))return value.map((v)=>String(v||"").trim()).filter(Boolean);const text=String(value||"").trim();if(!text)return[];return text.replace(/^\{|\}$/g,"").split(",").map((v)=>v.trim().replace(/^"|"$/g,"")).filter(Boolean);}
  function toDateObject(value){const [y,m,d]=String(value||"").split("-").map(Number);return y&&m&&d?new Date(y,m-1,d):null;}
  function toDateString(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
  function addDays(value,count){const date=toDateObject(value);if(!date)return"";date.setDate(date.getDate()+count);return toDateString(date);}
  function diffDays(a,b){const x=toDateObject(a),y=toDateObject(b);return x&&y?Math.floor((y-x)/86400000):0;}
  function taipeiDateString(date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);}
  function scheduleRange(settings={}){const today=toDateString(new Date());const anchor=toDateObject(settings.eight_week_start_date)?settings.eight_week_start_date:today;const periods=Math.floor(diffDays(anchor,today)/56);const start=addDays(anchor,periods*56)||today;return{startDate:start,endDate:addDays(start,55)};}
  function makeScheduleKey(memberId,workDate){const [y,m,d]=String(workDate||"").split("-").map(Number);return memberId&&y&&m&&d?`${memberId}_${y}_${m-1}_${d}`:"";}
  function entryKey(memberId,workDate){return `${memberId||""}|${workDate||""}`;}
  function mapScheduleRows(rows=[],members=[]){const memberIds=new Set((members||[]).map((m)=>m.id).filter(Boolean));const schedule={};for(const row of rows||[]){if(memberIds.size&&!memberIds.has(row.member_id))continue;const key=makeScheduleKey(row.member_id,row.work_date);if(!key)continue;const shift=row.shift_type_id||null,leave=row.leave_type_id||null,overtime=row.overtime_type_id||null;if(!shift&&!leave&&!overtime)continue;schedule[key]={shift,leave,overtime,leaveMeta:leave?{allDay:row.leave_all_day!==false,startTime:String(row.leave_start_time||"").slice(0,5),endTime:String(row.leave_end_time||"").slice(0,5),reasonEnabled:Boolean(row.leave_reason),reason:row.leave_reason||""}:null,overtimeMeta:overtime?{startTime:String(row.overtime_start_time||"").slice(0,5),endTime:String(row.overtime_end_time||"").slice(0,5),useRest1:Boolean(row.overtime_use_rest_1),rest1StartTime:String(row.overtime_rest_1_start_time||"").slice(0,5),rest1EndTime:String(row.overtime_rest_1_end_time||"").slice(0,5),useRest2:Boolean(row.overtime_use_rest_2),rest2StartTime:String(row.overtime_rest_2_start_time||"").slice(0,5),rest2EndTime:String(row.overtime_rest_2_end_time||"").slice(0,5),reason:row.overtime_reason||""}:null};}return schedule;}
  function mapDepartments(rows=[]){return rows.filter((r)=>r.id).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).map((r)=>({id:r.id,name:r.name||"",startDate:r.start_date||"",endDate:r.end_date||"",hiddenFromSchedule:Boolean(r.hidden_from_schedule),address:r.address||"",latitude:r.latitude??"",longitude:r.longitude??"",publicIp:r.public_ip||"",attendanceEnabled:Boolean(r.attendance_enabled),groupId:r.group_id||"",deleted:Boolean(r.deleted_at)}));}
  function mapMembers(rows=[]){return rows.map((r)=>({id:r.id,code:r.employee_code||"",name:r.full_name||"",deptId:r.home_department_id||"",scheduleShiftIds:[...new Set(normalizeTextArray(r.schedule_shift_ids))],positionId:"",proxyMemberId:"",hireDate:r.hire_date||"",leaveDate:r.leave_date||"",payByDay:Boolean(r.pay_by_day),fixedRestWeekday:clampInteger(r.fixed_rest_weekday,0,6,0),monthlyRestDays:Math.max(0,Number(r.monthly_rest_days)||0),roleId:r.access_role_id||"",groupId:r.group_id||"",deleted:Boolean(r.deleted_at)}));}
  function mapShifts(rows=[]){return rows.filter((r)=>r.id).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).map((r)=>({id:r.id,name:r.name||"",color:r.color||"#378ADD",textColor:r.text_color||"",autoTextColor:r.auto_text_color!==false,startTime:String(r.start_time||"").slice(0,5),endTime:String(r.end_time||"").slice(0,5),hiddenFromToolbar:Boolean(r.hidden_from_toolbar)||Boolean(r.deleted_at),deleted:Boolean(r.deleted_at),requiredStaffCount:Math.max(0,Number(r.required_staff_count)||0),applicableDeptId:r.applicable_department_id||"",positionRequirements:[],groupId:r.group_id||""}));}
  function mapLeaves(rows=[]){return rows.filter((r)=>r.id).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).map((r)=>({id:r.id,code:r.code||"",name:r.name||"",color:r.color||"#888780",textColor:r.text_color||"",autoTextColor:r.auto_text_color!==false,hiddenFromToolbar:Boolean(r.hidden_from_toolbar)||Boolean(r.deleted_at),deleted:Boolean(r.deleted_at),requiresTime:Boolean(r.requires_time),requiresReason:Boolean(r.requires_reason)}));}
  function mapOvertime(rows=[]){return rows.filter((r)=>r.id).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).map((r)=>({id:r.id,name:r.name||"加班",color:r.color||"#D85A30",textColor:r.text_color||"",autoTextColor:r.auto_text_color!==false,hiddenFromToolbar:Boolean(r.hidden_from_toolbar)||Boolean(r.deleted_at),deleted:Boolean(r.deleted_at),startTime:String(r.start_time||"").slice(0,5),endTime:String(r.end_time||"").slice(0,5),useRest1:Boolean(r.use_rest_1),rest1StartTime:String(r.rest_1_start_time||"").slice(0,5),rest1EndTime:String(r.rest_1_end_time||"").slice(0,5),useRest2:Boolean(r.use_rest_2),rest2StartTime:String(r.rest_2_start_time||"").slice(0,5),rest2EndTime:String(r.rest_2_end_time||"").slice(0,5)}));}
  function mapHolidays(rows=[]){return rows.sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).map((r)=>({id:r.id,date:r.holiday_date||"",name:r.name||""}));}

  async function loadEntryRows(startDate,endDate){const rows=[];let offset=0;for(;;){const page=await request(`/api/v1/schedule/entries${qs({startDate,endDate,offset,limit:1000})}`)||[];rows.push(...page);if(page.length<1000)break;offset+=page.length;}return rows;}
  async function loadState(){ensureSignedIn();const bootstrap=await request(`/api/v1/schedule/bootstrap${qs({documentId})}`);const settings=bootstrap?.settings||{};const range=scheduleRange(settings);const rows=await loadEntryRows(range.startDate,range.endDate);const departments=mapDepartments(bootstrap.departments||[]),members=mapMembers(bootstrap.members||[]);const archives=await request("/api/v1/schedule/archives")||[];const visible=toDateObject(range.startDate);return{year:visible?.getFullYear()||new Date().getFullYear(),month:visible?.getMonth()??new Date().getMonth(),selected:{type:null,id:null},deptFilter:"all",tableView:settings.table_view==="shift"?"shift":"member",tableDeptScopeFilter:"all",tableStatsVisible:settings.table_stats_visible!==false,scheduleStartDate:range.startDate,departments,members,shifts:mapShifts(bootstrap.shifts||[]),leaves:mapLeaves(bootstrap.leaves||[]),overtime:mapOvertime(bootstrap.overtime||[]),holidays:mapHolidays(bootstrap.holidays||[]),rules:{weekStart:clampInteger(settings.week_start,0,6,0),monthStartDay:clampInteger(settings.month_start_day,1,31,1),eightWeekStartDate:settings.eight_week_start_date||""},schedule:mapScheduleRows(rows,members),scheduleLoadedRanges:[range],accessBundle:bootstrap.accessBundle||{actor:{},groups:[],roles:[]},archiveRanges:archives.map((r)=>({groupId:r.group_id||r.groupId,startDate:r.start_date||r.startDate,endDate:r.end_date||r.endDate}))};}
  async function loadScheduleEntries(range={}){ensureSignedIn();const startDate=nullableDate(range.startDate),endDate=nullableDate(range.endDate);if(!startDate||!endDate)throw new Error("schedule range is required");const rows=await loadEntryRows(startDate,endDate);return{schedule:mapScheduleRows(rows,Array.isArray(range.members)?range.members:[]),scheduleLoadedRanges:[{startDate,endDate}]};}
  async function loadEmployeeAdminDirectory(){ensureSignedIn();return mapMembers(await request("/api/v1/members")||[]);}
  async function loadScheduleExportRows(startDate,endDate){const a=nullableDate(startDate),b=nullableDate(endDate);if(!a||!b||a>b)throw new Error("匯出日期範圍不正確");return request(`/api/v1/schedule/export${qs({startDate:a,endDate:b})}`)||[];}

  async function getDepartmentAttendanceSettings(){return (await request("/api/v1/attendance/department-settings")||[]).map((r)=>({departmentId:r.department_id,address:r.address||"",latitude:r.latitude,longitude:r.longitude,attendanceEnabled:Boolean(r.attendance_enabled),publicIp:r.public_ip||""}));}
  async function getTodayAttendance(){return request("/api/v1/attendance/today");}
  async function clockAttendance(action,position={}){return request("/api/v1/attendance/clock",{method:"POST",body:{action,deviceType:/Mobi|Mobile|iPhone|Android/i.test(navigator.userAgent||"")?"phone":"desktop",latitude:position.latitude,longitude:position.longitude,accuracy:position.accuracy,geolocationError:position.geolocationError||""}});}
  async function getPersonalRecords(filters={}){return request("/api/v1/attendance/personal/list",{method:"POST",body:filters});}
  async function savePersonalAttendanceDay(payload={}){return request("/api/v1/attendance/personal",{method:"PUT",body:payload});}
  async function getAttendanceReviewList(filters={}){return request("/api/v1/attendance/review/list",{method:"POST",body:filters});}
  async function saveAttendanceCommonNotes(payload={}){return request("/api/v1/attendance/review/common-notes",{method:"PUT",body:payload});}
  async function saveAttendanceReviewRecord(payload={}){return request("/api/v1/attendance/review/record",{method:"PUT",body:payload});}
  async function setAttendanceReviewed(payload={}){return request("/api/v1/attendance/review/set",{method:"POST",body:payload});}
  async function getAttendanceHistory(recordId){return request(`/api/v1/attendance/review/history${qs({recordId})}`);}
  async function getTodayMealOrder(){return request("/api/v1/meal/today");}
  async function saveTodayMealOrder(payload={}){return request("/api/v1/meal/today",{method:"PUT",body:{items:Array.isArray(payload.items)?payload.items:[],note:payload.note||""}});}
  async function cancelTodayMealOrder(){return request("/api/v1/meal/today/cancel",{method:"POST",body:{}});}
  async function getMealAdminSettings(){return request("/api/v1/meal/admin");}
  async function saveMealAdminSettings(payload={}){return request("/api/v1/meal/admin",{method:"PUT",body:payload});}
  async function deleteMealProduct(productId){return request("/api/v1/meal/admin/product/delete",{method:"POST",body:{productId}});}
  async function getMealReport(filters={}){return request("/api/v1/meal/report",{method:"POST",body:filters});}
  async function getMealStatsReport(filters={}){return getMealReport(filters);}

  async function syncMemberProfile(member,previousEmployeeCode=""){return request("/api/v1/members",{method:"PUT",body:{member:{employeeCode:String(member?.code||"").trim(),fullName:member?.name||"",groupId:member?.groupId||"",accessRoleId:member?.roleId||"",hireDate:member?.hireDate||null,leaveDate:member?.leaveDate||null,payByDay:Boolean(member?.payByDay),fixedRestWeekday:clampInteger(member?.fixedRestWeekday,0,6,0),homeDepartmentId:member?.deptId||"",scheduleShiftIds:Array.isArray(member?.scheduleShiftIds)?member.scheduleShiftIds:[],monthlyRestDays:Math.max(0,Number(member?.monthlyRestDays)||0)},previousEmployeeCode:String(previousEmployeeCode||"").trim()}});}
  async function resetMemberPassword(employeeCode){return request("/api/v1/members/password/reset",{method:"POST",body:{employeeCode:String(employeeCode||"").trim(),password:"0000"}});}
  async function deleteMemberProfile(employeeCode,currentPassword=""){return request("/api/v1/members/delete",{method:"POST",body:{employeeCode:String(employeeCode||"").trim(),currentPassword:String(currentPassword||"")}});}
  async function validateMemberGroupChange(employeeCode,groupId){return request("/api/v1/members/group-change/validate",{method:"POST",body:{employeeCode,groupId}});}

  async function saveDepartmentItem(department,sortOrder=0){return request("/api/v1/settings/department",{method:"PUT",body:{department:{...department,sortOrder}}});}
  async function deleteDepartmentItem(departmentId){return request("/api/v1/settings/department/delete",{method:"POST",body:{departmentId}});}
  async function saveShiftItem(shift,sortOrder=0){return request("/api/v1/settings/shift",{method:"PUT",body:{shift:{...shift,applicableDepartmentId:shift?.applicableDeptId||shift?.applicableDepartmentId||"",sortOrder}}});}
  async function saveCatalogItem(category,item,sortOrder=0){return request("/api/v1/settings/catalog",{method:"PUT",body:{category,item:{...item,sortOrder}}});}
  async function deleteCatalogItem(category,itemId){return request("/api/v1/settings/catalog/delete",{method:"POST",body:{category,itemId}});}
  async function reorderSettings(category,ids=[]){return request("/api/v1/settings/order",{method:"PUT",body:{category,ids:(Array.isArray(ids)?ids:[]).filter(isUuid)}});}
  async function saveSchedulerPreferences(state){return request("/api/v1/schedule/preferences",{method:"PUT",body:{documentId,settings:{currentYear:Number(state?.year)||new Date().getFullYear(),currentMonth:clampInteger(state?.month,0,11,new Date().getMonth()),deptFilter:state?.deptFilter||"all",tableView:state?.tableView==="shift"?"shift":"member",tableDeptScopeFilter:state?.tableDeptScopeFilter||"all",tableStatsVisible:state?.tableStatsVisible!==false,scheduleStartDate:nullableDate(state?.scheduleStartDate),weekStart:clampInteger(state?.rules?.weekStart,0,6,0),monthStartDay:clampInteger(state?.rules?.monthStartDay,1,31,1),eightWeekStartDate:nullableDate(state?.rules?.eightWeekStartDate)}}});}
  async function saveHolidays(holidays=[]){return request("/api/v1/schedule/holidays",{method:"PUT",body:{holidays:(Array.isArray(holidays)?holidays:[]).map((h)=>({id:h.id,date:h.date,name:h.name||"假日"}))}});}

  async function saveScheduleEntryRows(rows){const entries=(Array.isArray(rows)?rows:[]).filter((r)=>r?.member_id&&r?.work_date);return entries.length?request("/api/v1/schedule/entries",{method:"PUT",body:{entries}}):[];}
  async function saveScheduleCells(payloads){const rows=[];for(const payload of Array.isArray(payloads)?payloads:[]){const memberId=String(payload.memberId||"").trim(),workDate=nullableDate(payload.dateString||payload.workDate);if(!isUuid(memberId)||!workDate)throw new Error("schedule cell member UUID and date are required");if(payload.deleteEntry===true){rows.push({member_id:memberId,work_date:workDate,delete_entry:true});continue;}const slot=payload.slot&&typeof payload.slot==="object"?payload.slot:{};const shift=optionalUuid(slot.shift,"班別"),leave=optionalUuid(slot.leave,"假別"),overtime=optionalUuid(slot.overtime,"加班");if(!shift&&!leave&&!overtime)throw new Error("班表儲存內容不可空白");const allDay=slot.leaveMeta?.allDay!==false;rows.push({member_id:memberId,work_date:workDate,delete_entry:false,shift_type_id:shift,leave_type_id:leave,leave_all_day:allDay,leave_start_time:leave&&!allDay?nullableTime(slot.leaveMeta?.startTime):null,leave_end_time:leave&&!allDay?nullableTime(slot.leaveMeta?.endTime):null,leave_reason:leave?slot.leaveMeta?.reason||null:null,overtime_type_id:overtime,overtime_start_time:overtime?nullableTime(slot.overtimeMeta?.startTime):null,overtime_end_time:overtime?nullableTime(slot.overtimeMeta?.endTime):null,overtime_use_rest_1:overtime?Boolean(slot.overtimeMeta?.useRest1):false,overtime_rest_1_start_time:overtime&&slot.overtimeMeta?.useRest1?nullableTime(slot.overtimeMeta?.rest1StartTime):null,overtime_rest_1_end_time:overtime&&slot.overtimeMeta?.useRest1?nullableTime(slot.overtimeMeta?.rest1EndTime):null,overtime_use_rest_2:overtime?Boolean(slot.overtimeMeta?.useRest2):false,overtime_rest_2_start_time:overtime&&slot.overtimeMeta?.useRest2?nullableTime(slot.overtimeMeta?.rest2StartTime):null,overtime_rest_2_end_time:overtime&&slot.overtimeMeta?.useRest2?nullableTime(slot.overtimeMeta?.rest2EndTime):null,overtime_reason:overtime?slot.overtimeMeta?.reason||null:null});}const saved=await saveScheduleEntryRows(rows);const expected=new Set(rows.filter((r)=>!r.delete_entry).map((r)=>entryKey(r.member_id,r.work_date))),actual=new Set((saved||[]).map((r)=>entryKey(r.member_id,r.work_date)));if([...expected].some((k)=>!actual.has(k)))throw new Error("班表資料未成功寫入，請重新操作");return{ok:true,rows:saved};}
  async function saveScheduleCell(payload){const result=await saveScheduleCells([payload]);return{ok:true,row:result.rows?.[0]||null};}

  async function getGroupAccessBundle(){return request("/api/v1/access")||{};}
  async function getScheduleArchives(groupId=null){return request(`/api/v1/schedule/archives${qs({groupId})}`)||[];}
  async function getScheduleArchiveRanges(){return (await getScheduleArchives()).map((r)=>({groupId:r.group_id||r.groupId,startDate:r.start_date||r.startDate,endDate:r.end_date||r.endDate}));}
  async function archiveSchedule(groupId,startDate,endDate){return request("/api/v1/schedule/archives",{method:"POST",body:{groupId,startDate,endDate}});}
  async function unarchiveSchedule(archiveId){return request("/api/v1/schedule/archives/unarchive",{method:"POST",body:{archiveId}});}
  async function getScheduleArchiveDetail(archiveId){return request(`/api/v1/schedule/archives/entries${qs({archiveId})}`)||[];}
  async function saveScheduleGroup(group){return request("/api/v1/settings/group",{method:"PUT",body:{group}});}
  async function deleteScheduleGroup(groupId,confirmName){return request("/api/v1/settings/group/delete",{method:"POST",body:{groupId,confirmName}});}
  async function reorderScheduleGroups(groupIds){return request("/api/v1/settings/groups/order",{method:"PUT",body:{groupIds}});}
  async function saveAccessRole(role){return request("/api/v1/settings/access-role",{method:"PUT",body:{role}});}
  async function deleteAccessRole(roleId){return request("/api/v1/settings/access-role/delete",{method:"POST",body:{roleId}});}

  function compactDate(value){return String(value||"").replace(/[^0-9]/g,"").slice(0,8);}
  function rangeName(prefix,payload,ext){return `${prefix}_${compactDate(payload.startDate)}-${compactDate(payload.endDate)}.${ext}`;}
  function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function pickFile(accept){return new Promise((resolve)=>{const input=document.createElement("input");input.type="file";input.accept=accept;input.style.display="none";document.body.appendChild(input);input.addEventListener("change",()=>{const file=input.files?.[0]||null;input.remove();resolve(file);},{once:true});input.click();});}
  function formatHours(value){const minutes=Math.round(Number(value)*60);return Number.isFinite(minutes)&&minutes>0?`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`:"";}
  function subtractHours(value,hours){const m=String(value||"").match(/^([01]\d|2[0-3]):([0-5]\d)/);if(!m)return{time:"",previousDay:0};const base=Number(m[1])*60+Number(m[2]),delta=Math.round(Number(hours||0)*60),shift=base-(Number.isFinite(delta)?delta:0),n=((shift%1440)+1440)%1440;return{time:`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`,previousDay:shift<0?1:0};}
  function addMinutes(value,delta){const m=String(value||"").match(/^([01]\d|2[0-3]):([0-5]\d)/);if(!m)return"";const n=((Number(m[1])*60+Number(m[2])+Number(delta||0))%1440+1440)%1440;return`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;}
  async function exportSapCsv(payload){if(!exporter.getSapLeaveExportRows(payload).length)return{canceled:true,empty:true};const blob=new Blob([exporter.buildSapLeaveCsvContent(payload)],{type:"text/csv;charset=utf-8"}),fileName=rangeName("sap請假",payload,"csv");downloadBlob(blob,fileName);return{canceled:false,empty:false,filePath:fileName};}
  async function exportOvertime(payload){if(!exporter.getOvertimeExportRows(payload).length)return{canceled:true,empty:true};const blob=await exporter.workbookToBlob(await exporter.createOvertimeWorkbook(payload)),fileName=rangeName("匯出加班",payload,"xlsx");downloadBlob(blob,fileName);return{canceled:false,empty:false,filePath:fileName};}
  async function exportLeave(payload){if(!exporter.getLeaveExportRows(payload).length)return{canceled:true,empty:true};const blob=await exporter.workbookToBlob(await exporter.createLeaveWorkbook(payload)),fileName=rangeName("匯出請假",payload,"xlsx");downloadBlob(blob,fileName);return{canceled:false,empty:false,filePath:fileName};}
  async function exportMealReport(report={}){const workbook=await exporter.createMealReportWorkbook(report);if(!workbook)return{canceled:true,empty:true};const fileName=`訂餐統計_${compactDate(report.fromDate)}-${compactDate(report.toDate)}.xlsx`;downloadBlob(await exporter.workbookToBlob(workbook),fileName);return{canceled:false,filePath:fileName};}
  async function exportAttendanceReview(filters={}){const result=await request("/api/v1/attendance/review/export",{method:"POST",body:{fromDate:filters.fromDate,toDate:filters.toDate,memberId:filters.memberId||""}});const exportRows=(Array.isArray(result?.rows)?result.rows:[]).flatMap((row)=>{const start=row.restDayScheduled?String(row.scheduledShiftStartTime||""):"",end=row.restDayScheduled?String(row.scheduledShiftEndTime||""):"";if(start&&end){const adjusted=subtractHours(start,row.overtimeHours),otStart=adjusted.time||start;return[{employee_code:row.employee_code||"",work_date:row.work_date||"",overtime_type_id:"attendance-rest-day",overtime_start_time:otStart,overtime_end_time:end,overtime_previous_day:adjusted.previousDay,overtime_subsidy_type:1,overtime_use_rest_1:true,overtime_rest_1_start_time:addMinutes(otStart,240),overtime_rest_1_end_time:addMinutes(otStart,300),overtime_rest_1_paid:0,overtime_use_rest_2:false}];}if(!(Number(row.overtimeHours)>0))return[];return[{employee_code:row.employee_code||"",work_date:row.work_date||"",overtime_type_id:"attendance-ledger",overtime_start_time:"00:00",overtime_end_time:formatHours(row.overtimeHours),overtime_previous_day:0,overtime_subsidy_type:1,overtime_use_rest_1:false,overtime_use_rest_2:false}];});return exportOvertime({startDate:filters.fromDate,endDate:filters.toDate,exportRows});}
  async function workbookExport(factory,payload,fileName){downloadBlob(await exporter.workbookToBlob(await factory(payload)),fileName);return{canceled:false,filePath:fileName};}
  async function workbookImport(accept,parser,resultKey="rows"){const file=await pickFile(accept);if(!file)return{canceled:true,[resultKey]:resultKey==="rows"?[]:null};return{canceled:false,[resultKey]:await parser(await file.arrayBuffer())};}
  const xlsx=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const exportMembers=(p)=>workbookExport(exporter.createMemberWorkbook,p,"人員資料.xlsx");
  const importMembers=()=>workbookImport(xlsx,exporter.parseMemberWorkbook,"rows");
  const exportDepartments=(p)=>workbookExport(exporter.createDepartmentWorkbook,p,"單位設定.xlsx");
  const importDepartments=()=>workbookImport(xlsx,exporter.parseDepartmentWorkbook,"rows");
  const exportShifts=(p)=>workbookExport(exporter.createShiftWorkbook,p,"班別設定.xlsx");
  const importShifts=()=>workbookImport(xlsx,exporter.parseShiftWorkbook,"rows");
  const exportLeaveSettings=(p)=>workbookExport(exporter.createLeaveSettingsWorkbook,p,"假別設定.xlsx");
  const importLeaveSettings=()=>workbookImport(xlsx,exporter.parseLeaveSettingsWorkbook,"result");
  const exportOvertimeSettings=(p)=>workbookExport(exporter.createOvertimeSettingsWorkbook,p,"加班設定.xlsx");
  const importOvertimeSettings=()=>workbookImport(xlsx,exporter.parseOvertimeSettingsWorkbook,"result");

  window.schedulerApi={
    initializeAuth,getAuthContext:()=>({session:currentSession,profile:currentProfile}),signIn,signOut,changePassword,
    getDepartmentAttendanceSettings,getTodayAttendance,clockAttendance,getTodayMealOrder,saveTodayMealOrder,getPersonalRecords,savePersonalAttendanceDay,getAttendanceReviewList,saveAttendanceCommonNotes,saveAttendanceReviewRecord,setAttendanceReviewed,getAttendanceHistory,getMealStatsReport,getMealAdminSettings,saveMealAdminSettings,deleteMealProduct,getMealReport,cancelTodayMealOrder,deleteMemberProfile,
    loadState,loadEmployeeAdminDirectory,loadScheduleEntries,loadScheduleExportRows,saveDepartmentItem,deleteDepartmentItem,saveShiftItem,saveCatalogItem,deleteCatalogItem,saveScheduleCells,saveScheduleCell,reorderSettings,saveSchedulerPreferences,saveHolidays,getGroupAccessBundle,getScheduleArchiveRanges,saveScheduleGroup,deleteScheduleGroup,reorderScheduleGroups,saveAccessRole,deleteAccessRole,validateMemberGroupChange,getScheduleArchives,archiveSchedule,unarchiveSchedule,getScheduleArchiveDetail,syncMemberProfile,resetMemberPassword,
    exportSapCsv,exportAttendanceReview,exportOvertime,exportLeave,exportMealReport,exportMembers,importMembers,exportDepartments,importDepartments,exportShifts,importShifts,exportLeaveSettings,importLeaveSettings,exportOvertimeSettings,importOvertimeSettings,
    getAppInfo:async()=>({databasePath:`PostgreSQL / ${documentId}`,backend:"fyh-api",updatedAt:null}),
    showMessage:async(_title,message)=>window.alert(message),confirmAction:async(_title,message)=>window.confirm(message)
  };
})();
