const { BackendError } = require("./errors");

const PAGE_SIZE = 50;
const MAX_GPS_DISTANCE_METERS = 300;
const MAX_GPS_ACCURACY_METERS = 300;
const ISSUE_TYPES = ["未打上班", "未打下班", "無排班但有打卡", "遲到", "早退", "上班晚於下班", "上班地點不符", "下班地點不符"];

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function taipeiTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
function addDays(value, days) {
  const date = new Date(`${value}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return taipeiDate(date);
}
function validDate(value, fallback = "") {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}
function datesBetween(fromDate, toDate) {
  const rows = [];
  for (let value = fromDate; value <= toDate; value = addDays(value, 1)) rows.push(value);
  return rows;
}
function hoursToMinutes(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || Math.round(hours * 2) !== hours * 2) throw new BackendError(400, "ATTENDANCE_HOURS_INVALID", "工時必須以 0.5 小時為單位");
  const minutes = Math.round(hours * 60);
  if (minutes > 32760) throw new BackendError(400, "ATTENDANCE_HOURS_INVALID", "工時超過可輸入範圍");
  return minutes;
}
function minutesToHours(value) { return value === null || value === undefined ? null : Number(value) / 60; }
function timeToIso(workDate, value) {
  const time = String(value || "").trim();
  if (!time) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new BackendError(400, "ATTENDANCE_TIME_INVALID", "打卡時間格式錯誤");
  return new Date(`${workDate}T${time}:00+08:00`).toISOString();
}
function normalizeNotes(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
}
function shiftMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}
function punchMinutes(value) {
  if (!value) return null;
  const date = new Date(value); if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
}
function issues(record, shift, workDate, today = taipeiDate()) {
  const output = []; const hasIn = Boolean(record?.clock_in_at); const hasOut = Boolean(record?.clock_out_at);
  if (!shift) { if (hasIn || hasOut) output.push("無排班但有打卡"); return output; }
  const start = shiftMinutes(shift.start_time); const end = shiftMinutes(shift.end_time);
  if (start === null || end === null) return ["班別缺少完整上下班時間"];
  const inMinutes = hasIn ? punchMinutes(record.clock_in_at) : null;
  const outMinutes = hasOut ? punchMinutes(record.clock_out_at) : null;
  const now = shiftMinutes(taipeiTime()) || 0; const past = workDate < today; const same = workDate === today;
  if (!hasIn && (past || (same && now >= start + 1))) output.push("未打上班");
  if (!hasOut && (past || (same && now >= end + 1))) output.push("未打下班");
  if (inMinutes !== null && inMinutes >= start + 1) output.push("遲到");
  if (outMinutes !== null && outMinutes < end) output.push("早退");
  if (hasIn && hasOut && new Date(record.clock_in_at) > new Date(record.clock_out_at)) output.push("上班晚於下班");
  const inDept = String(record?.clock_in_location?.departmentId || ""); const outDept = String(record?.clock_out_location?.departmentId || "");
  if (hasIn && inDept && shift.applicable_department_id && inDept !== shift.applicable_department_id) output.push("上班地點不符");
  if (hasOut && outDept && shift.applicable_department_id && outDept !== shift.applicable_department_id) output.push("下班地點不符");
  return output;
}
function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = (v) => v * Math.PI / 180; const r = 6371000; const dLat = rad(lat2-lat1); const dLon = rad(lon2-lon1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon/2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function clientIp(headers = {}) { return String(headers["cf-connecting-ip"] || headers["x-real-ip"] || String(headers["x-forwarded-for"] || "").split(",")[0] || "").trim(); }
function ipMatches(allowed, actual) { return Boolean(allowed && actual && String(allowed).split(/[\s,;]+/).includes(actual)); }
function isPhone(headers = {}, requested) {
  const ua = String(headers["user-agent"] || ""); const tablet = /iPad|Tablet|Silk|Android(?!.*Mobile)/i.test(ua);
  return !tablet && (requested === "phone" || headers["sec-ch-ua-mobile"] === "?1" || /iPhone|iPod|Windows Phone|Mobi|Mobile/i.test(ua));
}

function createNativeAttendance(database) {
  async function actor(employeeId, permission = "") {
    const row = await database.one(`select e.*, r.permissions from public.set_employee e left join public.access_roles r on r.id=e.access_role_id where e.id=$1::uuid and e.deleted_at is null and public.is_employee_account_effective(e.hire_date,e.leave_date,(timezone('Asia/Taipei',now()))::date) limit 1`, [employeeId]);
    if (!row?.id) throw new BackendError(401, "AUTH_REQUIRED", "此帳號目前不在有效期間");
    if (permission && !(row.permissions || []).includes(permission)) throw new BackendError(403, "ATTENDANCE_PERMISSION_DENIED", permission === "attendance_review" ? "沒有簽到審核權限" : "沒有權限");
    return row;
  }
  async function groupIds(roleId) {
    const result = await database.query("select group_id from public.access_role_groups where role_id=$1::uuid", [roleId]);
    return (result.rows || []).map((r) => String(r.group_id));
  }
  async function commonNotes() { const row = await database.one("select attendance_common_notes from public.scheduler_settings where id='default'"); return normalizeNotes(row?.attendance_common_notes); }
  async function scheduleRows(memberIds, fromDate, toDate) {
    if (!memberIds.length) return [];
    const result = await database.query(`select se.member_id,se.work_date,se.support_department_id,se.shift_type_id,se.leave_type_id,se.overtime_type_id, s.name as shift_name,s.start_time,s.end_time,s.applicable_department_id,s.color as shift_color,s.text_color as shift_text_color,s.auto_text_color as shift_auto_text_color, l.code as leave_code,l.name as leave_name,l.color as leave_color,l.text_color as leave_text_color,l.auto_text_color as leave_auto_text_color, o.name as overtime_name,o.color as overtime_color,o.text_color as overtime_text_color,o.auto_text_color as overtime_auto_text_color from public.schedule_entries se left join public.set_shift s on s.id=se.shift_type_id left join public.set_leave l on l.id=se.leave_type_id left join public.set_overtime o on o.id=se.overtime_type_id where se.member_id=any($1::uuid[]) and se.work_date between $2::date and $3::date`, [memberIds, fromDate, toDate]);
    return result.rows || [];
  }
  function display(schedule) {
    if (!schedule) return { shift: null, shiftName: "", shiftTime: "", scheduleSegments: [], schedule: null };
    const shift = schedule.shift_type_id ? { id:schedule.shift_type_id,name:schedule.shift_name,start_time:schedule.start_time,end_time:schedule.end_time,applicable_department_id:schedule.applicable_department_id,color:schedule.shift_color,text_color:schedule.shift_text_color,auto_text_color:schedule.shift_auto_text_color } : null;
    const segments = [];
    if (shift) segments.push({ category:"shift", itemId:shift.id, code:"", name:shift.name||"", color:shift.color||"#378ADD", textColor:shift.text_color||"", autoTextColor:shift.auto_text_color!==false });
    if (schedule.leave_type_id) segments.push({ category:"leave", itemId:schedule.leave_type_id, code:schedule.leave_code||"", name:schedule.leave_name||"", color:schedule.leave_color||"#888780", textColor:schedule.leave_text_color||"", autoTextColor:schedule.leave_auto_text_color!==false });
    if (schedule.overtime_type_id) segments.push({ category:"overtime", itemId:schedule.overtime_type_id, code:"", name:schedule.overtime_name||"加班", color:schedule.overtime_color||"#D85A30", textColor:schedule.overtime_text_color||"", autoTextColor:schedule.overtime_auto_text_color!==false });
    return { shift, shiftName:shift?.name||"", shiftTime:shift ? `${String(shift.start_time||"").slice(0,5)}-${String(shift.end_time||"").slice(0,5)}`:"", scheduleSegments:segments, schedule };
  }
  async function departmentSettings(employeeId) {
    const a = await actor(employeeId); if (!(a.permissions || []).includes("permission_settings")) throw new BackendError(403,"ATTENDANCE_PERMISSION_DENIED","沒有權限設定權限");
    const result = await database.query(`select d.id as department_id,d.address,d.latitude,d.longitude,d.attendance_enabled,d.public_ip from public.set_departments d join public.access_role_groups rg on rg.role_id=$1::uuid and rg.group_id=d.group_id where d.deleted_at is null and 'department_settings'=any($2::text[]) order by d.sort_order,d.name,d.id`, [a.access_role_id,a.permissions||[]]);
    return result.rows || [];
  }
  async function today(employeeId) {
    const a=await actor(employeeId); if (!a.group_id) throw new BackendError(400,"ATTENDANCE_GROUP_REQUIRED","帳號尚未設定群組，無法打卡");
    const workDate=taipeiDate(); const record=await database.one("select * from public.attendance_days where user_id=$1::uuid and work_date=$2::date",[a.id,workDate]);
    return {ok:true,profile:a,record:record||null,serverDate:workDate};
  }
  async function clock(employeeId, body={}, headers={}) {
    const a=await actor(employeeId); if (!a.group_id) throw new BackendError(400,"ATTENDANCE_GROUP_REQUIRED","帳號尚未設定群組，無法打卡");
    const departments=(await database.query("select id,name,address,latitude,longitude,public_ip from public.set_departments where group_id=$1::uuid and attendance_enabled=true and deleted_at is null",[a.group_id])).rows||[];
    if (!departments.length) throw new BackendError(400,"ATTENDANCE_LOCATION_UNAVAILABLE","所屬群組目前沒有啟用打卡的單位，請洽管理員確認打卡設定");
    const ip=clientIp(headers); let location=null;
    if (isPhone(headers,body.deviceType)) {
      const lat=Number(body.latitude), lon=Number(body.longitude), accuracy=Number(body.accuracy);
      if (Number.isFinite(lat)&&Number.isFinite(lon)&&Number.isFinite(accuracy)&&accuracy<=MAX_GPS_ACCURACY_METERS) {
        const nearest=departments.map((d)=>({d,distance:Number.isFinite(Number(d.latitude))&&Number.isFinite(Number(d.longitude))?distanceMeters(lat,lon,Number(d.latitude),Number(d.longitude)):Infinity})).sort((x,y)=>x.distance-y.distance)[0];
        if (nearest&&nearest.distance<=MAX_GPS_DISTANCE_METERS) location={departmentId:nearest.d.id,name:nearest.d.name||"",address:nearest.d.address||"",source:"GPS",latitude:lat,longitude:lon,accuracy,distance:Math.round(nearest.distance),ip};
      }
    }
    if (!location) { const d=departments.find((item)=>ipMatches(item.public_ip,ip)); if (d) location={departmentId:d.id,name:d.name||"",address:d.address||"",source:"IP",latitude:null,longitude:null,accuracy:null,distance:null,ip}; }
    if (!location) throw new BackendError(400,"ATTENDANCE_LOCATION_DENIED","目前位置或網路不符合所屬群組的打卡條件，請確認定位權限或洽管理員");
    const kind=String(body.action||""); if (!['clock_in','clock_out'].includes(kind)) throw new BackendError(400,"ATTENDANCE_ACTION_INVALID","不支援的打卡操作");
    const workDate=taipeiDate();
    return database.transaction(async(tx)=>{
      await tx.query(`insert into public.attendance_days(user_id,work_date,group_id,group_name_snapshot,department_name_snapshot)
        select e.id,$2::date,e.group_id,coalesce(g.name,''),coalesce(d.name,'')
        from public.set_employee e
        left join public.schedule_groups g on g.id=e.group_id
        left join public.set_departments d on d.id=e.home_department_id
        where e.id=$1::uuid
        on conflict(user_id,work_date) do nothing`,[a.id,workDate]);
      const old=await tx.one("select * from public.attendance_days where user_id=$1::uuid and work_date=$2::date for update",[a.id,workDate]);
      if(!old)throw new BackendError(500,"ATTENDANCE_CLOCK_STATE_INVALID","無法建立今日簽到紀錄");
      if(old.reviewed_at)throw new BackendError(409,"ATTENDANCE_REVIEWED","此日簽到紀錄已審，無法再打卡");
      const duplicate=kind==='clock_in'?Boolean(old.clock_in_at):Boolean(old.clock_out_at);
      if(duplicate)return {ok:true,record:old,duplicate:true,serverDate:workDate};
      const row=kind==='clock_in'
        ?await tx.one("update public.attendance_days set clock_in_at=now(),clock_in_location=$2::jsonb,updated_at=now() where id=$1::uuid returning *",[old.id,JSON.stringify(location)])
        :await tx.one("update public.attendance_days set clock_out_at=now(),clock_out_location=$2::jsonb,updated_at=now() where id=$1::uuid returning *",[old.id,JSON.stringify(location)]);
      await audit(tx,old.id,kind,a.id,old,row);
      return {ok:true,record:row,duplicate:false,serverDate:workDate};
    });
  }
  async function personalList(employeeId, body={}) {
    const a=await actor(employeeId); const todayDate=taipeiDate(); const toDate=validDate(body.toDate,todayDate); const fromDate=validDate(body.fromDate,addDays(todayDate,-49)); const page=Math.max(1,Number(body.page)||1);
    const attendance=(await database.query("select * from public.attendance_days where user_id=$1::uuid and work_date between $2::date and $3::date",[a.id,fromDate,toDate])).rows||[];
    const meals=(await database.query("select * from public.meal_orders where user_id=$1::uuid and order_date between $2::date and $3::date",[a.id,fromDate,toDate])).rows||[];
    const schedules=await scheduleRows([a.id],fromDate,toDate); const sMap=new Map(schedules.map((r)=>[`${r.member_id}:${r.work_date}`,r])); const aMap=new Map(attendance.map((r)=>[String(r.work_date),r])); const mMap=new Map(); for(const r of meals){const list=mMap.get(String(r.order_date))||[];list.push(r);mMap.set(String(r.order_date),list);}
    const cutoff=String((await database.one("select daily_cutoff_time from public.meal_settings where id='default'"))?.daily_cutoff_time||"10:30").slice(0,5); const notes=await commonNotes();
    const records=datesBetween(fromDate,toDate).filter((d)=>(!a.hire_date||d>=String(a.hire_date))&&(!a.leave_date||d<=String(a.leave_date))).sort().reverse().map((date)=>{ const rec=aMap.get(date)||null; const sd=display(sMap.get(`${a.id}:${date}`)); const meal=mMap.get(date)||[]; return {id:rec?.id||"",date,...sd,clockIn:rec?.clock_in_at||null,clockInLocation:rec?.clock_in_location||null,clockOut:rec?.clock_out_at||null,clockOutLocation:rec?.clock_out_location||null,regularHours:minutesToHours(rec?.regular_minutes),overtimeHours:minutesToHours(rec?.overtime_minutes),note:rec?.note||"",reviewed:Boolean(rec?.reviewed_at),reviewedAt:rec?.reviewed_at||null,issues:issues(rec||{},sd.shift,date,todayDate),editable:!rec?.reviewed_at,mealText:meal.map((x)=>`${x.product_name_snapshot}×${x.quantity}`).join("、"),mealOrderId:meal[0]?.order_id||"",canCancelMeal:Boolean(meal.length&&date===todayDate&&taipeiTime()<=cutoff),mealClockDeletedWarning:Boolean(meal.length&&!rec?.clock_in_at)}; });
    const offset=(page-1)*PAGE_SIZE; return {ok:true,records:records.slice(offset,offset+PAGE_SIZE),commonNotes:notes,total:records.length,page,pageSize:PAGE_SIZE,fromDate,toDate,serverDate:todayDate};
  }
  async function ensureDay(tx,userId,workDate) {
    let row=await tx.one("select * from public.attendance_days where user_id=$1::uuid and work_date=$2::date",[userId,workDate]); if(row)return row;
    row=await tx.one(`insert into public.attendance_days(user_id,work_date,group_id,group_name_snapshot,department_name_snapshot) select e.id,$2::date,e.group_id,coalesce(g.name,''),coalesce(d.name,'') from public.set_employee e left join public.schedule_groups g on g.id=e.group_id left join public.set_departments d on d.id=e.home_department_id where e.id=$1::uuid returning *`,[userId,workDate]); return row;
  }
  async function audit(tx,rowId,action,actorId,before,after,reason="") { await tx.query("insert into public.attendance_audit_logs(attendance_day_id,action,changed_by,before_data,after_data,reason) values($1::uuid,$2,$3::uuid,$4::jsonb,$5::jsonb,$6)",[rowId,action,actorId,JSON.stringify(before||{}),JSON.stringify(after||{}),String(reason||"")]); }
  async function personalSave(employeeId,body={}) {
    const a=await actor(employeeId); const workDate=validDate(body.workDate,""); if(!workDate|| (a.hire_date&&workDate<String(a.hire_date)) || (a.leave_date&&workDate>String(a.leave_date))) throw new BackendError(400,"ATTENDANCE_DATE_INVALID","只能修改任職期間的簽到資料"); const field=String(body.field||""); if(!['regularHours','overtimeHours','note'].includes(field)) throw new BackendError(400,"ATTENDANCE_FIELD_INVALID","不支援的簽到欄位");
    return database.transaction(async(tx)=>{const old=await ensureDay(tx,a.id,workDate); if(old.reviewed_at)throw new BackendError(409,"ATTENDANCE_REVIEWED","此日簽到紀錄已審，無法修改"); let row; if(field==='note')row=await tx.one("update public.attendance_days set note=$2,updated_at=now() where id=$1::uuid returning *",[old.id,String(body.value||"")]); else row=await tx.one(`update public.attendance_days set ${field==='regularHours'?'regular_minutes':'overtime_minutes'}=$2::smallint,updated_at=now() where id=$1::uuid returning *`,[old.id,hoursToMinutes(body.value)]); await audit(tx,old.id,`employee_${field}`,a.id,old,row); return {ok:true,record:row};});
  }
  async function reviewer(employeeId) { return actor(employeeId,"attendance_review"); }
  async function allowedTarget(a,userId) { const row=await database.one(`select e.* from public.set_employee e join public.access_role_groups rg on rg.role_id=$1::uuid and rg.group_id=e.group_id where e.id=$2::uuid and e.deleted_at is null`,[a.access_role_id,userId]); if(!row)throw new BackendError(403,"ATTENDANCE_PERMISSION_DENIED","此角色不可審核該群組"); return row; }
  async function reviewList(employeeId,body={},exportOnly=false) {
    const a=await reviewer(employeeId); const todayDate=taipeiDate(); const fromDate=validDate(body.fromDate,addDays(todayDate,-30)); const toDate=validDate(body.toDate,todayDate); const allowed=await groupIds(a.access_role_id); const requested=String(body.groupId||""); if(requested&&!allowed.includes(requested))throw new BackendError(403,"ATTENDANCE_PERMISSION_DENIED","此角色不可查看該群組"); const groups=requested?[requested]:allowed; const page=Math.max(1,Number(body.page)||1); if(!groups.length)return {ok:true,members:[],departments:[],issueTypes:ISSUE_TYPES,commonNotes:await commonNotes(),rows:[],total:0,page,pageSize:PAGE_SIZE};
    const members=(await database.query("select id,employee_code,full_name,group_id,home_department_id,hire_date,leave_date from public.set_employee where group_id=any($1::uuid[]) and deleted_at is null order by employee_code",[groups])).rows||[]; const memberIds=members.map((m)=>m.id); const departments=(await database.query("select id,name,group_id from public.set_departments where group_id=any($1::uuid[]) and deleted_at is null",[groups])).rows||[]; const attendance=memberIds.length?(await database.query("select * from public.attendance_days where user_id=any($1::uuid[]) and work_date between $2::date and $3::date",[memberIds,fromDate,toDate])).rows||[]:[]; const schedules=await scheduleRows(memberIds,fromDate,toDate); const aMap=new Map(attendance.map((r)=>[`${r.user_id}:${r.work_date}`,r])); const sMap=new Map(schedules.map((r)=>[`${r.member_id}:${r.work_date}`,r])); const gRows=(await database.query("select id,name from public.schedule_groups where id=any($1::uuid[])",[groups])).rows||[]; const gMap=new Map(gRows.map((r)=>[String(r.id),r.name])); const dMap=new Map(departments.map((r)=>[String(r.id),r.name])); const status=exportOnly?'reviewed':String(body.status||'unreviewed'); const memberFilter=String(body.memberId||''); const issueType=String(body.issueType||''); const rows=[];
    for(const date of datesBetween(fromDate,toDate))for(const m of members){if(memberFilter&&String(m.id)!==memberFilter)continue;if((m.hire_date&&date<String(m.hire_date))||(m.leave_date&&date>String(m.leave_date)))continue;const current=aMap.get(`${m.id}:${date}`)||null;const reviewed=Boolean(current?.reviewed_at);if(status==='reviewed'&&!reviewed)continue;if(status==='unreviewed'&&reviewed)continue;const sd=display(sMap.get(`${m.id}:${date}`));const currentIssues=issues(current||{},sd.shift,date,todayDate);if(issueType&&issueType!=='__all__'&&!currentIssues.includes(issueType))continue;const departmentId=sd.schedule?.support_department_id||m.home_department_id||"";rows.push({id:current?.id||"",user_id:m.id,work_date:date,employee_code:m.employee_code||"",employee_name:m.full_name||"",groupId:m.group_id||current?.group_id||"",groupName:current?.group_name_snapshot||gMap.get(String(m.group_id))||"",departmentId,departmentName:current?.department_name_snapshot||dMap.get(String(departmentId))||"",...sd,clock_in_at:current?.clock_in_at||null,clock_in_location:current?.clock_in_location||null,clock_out_at:current?.clock_out_at||null,clock_out_location:current?.clock_out_location||null,regularHours:minutesToHours(current?.regular_minutes),overtimeHours:minutesToHours(current?.overtime_minutes),note:current?.note||"",reviewed,reviewedAt:current?.reviewed_at||null,issues:currentIssues});}
    rows.sort((x,y)=>String(y.work_date).localeCompare(String(x.work_date))||String(x.employee_code).localeCompare(String(y.employee_code)));const offset=exportOnly?0:(page-1)*PAGE_SIZE;return {ok:true,members:members.map((m)=>({id:m.id,employee_code:m.employee_code,full_name:m.full_name,group_id:m.group_id})),departments,issueTypes:ISSUE_TYPES,commonNotes:await commonNotes(),rows:exportOnly?rows:rows.slice(offset,offset+PAGE_SIZE),total:rows.length,page,pageSize:exportOnly?rows.length:PAGE_SIZE};
  }
  async function saveCommonNotes(employeeId,body={}) { await reviewer(employeeId); const notes=normalizeNotes(body.notes); await database.query("update public.scheduler_settings set attendance_common_notes=$1,updated_at=now() where id='default'",[notes.join("\n")]); return {ok:true,commonNotes:notes}; }
  async function reviewSave(employeeId,body={}) { const a=await reviewer(employeeId); const userId=String(body.userId||""); const workDate=validDate(body.workDate,""); if(!userId||!workDate)throw new BackendError(400,"ATTENDANCE_INPUT_REQUIRED","缺少人員或日期"); const target=await allowedTarget(a,userId); return database.transaction(async(tx)=>{const old=await ensureDay(tx,userId,workDate); const location=async(value,oldLoc,clockAt)=>{if(!clockAt)return null;const id=String(value||"");if(!id)return oldLoc||{name:"管理員補登",source:"管理員補登"};const d=await tx.one("select id,name,address,group_id from public.set_departments where id=$1::uuid and deleted_at is null",[id]);if(!d||String(d.group_id)!==String(target.group_id))throw new BackendError(400,"ATTENDANCE_LOCATION_INVALID","打卡地點不屬於該人員群組");return {departmentId:d.id,name:d.name||"",address:d.address||"",source:"管理員修改",accuracy:null,distance:null};}; const clockInAt=timeToIso(workDate,body.clockInTime),clockOutAt=timeToIso(workDate,body.clockOutTime); const inLoc=await location(body.clockInLocationDepartmentId,old.clock_in_location,clockInAt),outLoc=await location(body.clockOutLocationDepartmentId,old.clock_out_location,clockOutAt); const row=await tx.one("update public.attendance_days set clock_in_at=$2::timestamptz,clock_out_at=$3::timestamptz,clock_in_location=$4::jsonb,clock_out_location=$5::jsonb,regular_minutes=$6::smallint,overtime_minutes=$7::smallint,note=$8,reviewed_at=null,reviewed_by=null,updated_at=now() where id=$1::uuid returning *",[old.id,clockInAt,clockOutAt,JSON.stringify(inLoc),JSON.stringify(outLoc),hoursToMinutes(body.regularHours),hoursToMinutes(body.overtimeHours),String(body.note||"")]);await audit(tx,old.id,'admin_edit',a.id,old,row,body.reason);return {ok:true,record:row};}); }
  async function reviewSet(employeeId,body={}) { const a=await reviewer(employeeId); const reviewed=Boolean(body.reviewed); const raw=Array.isArray(body.tokens)?body.tokens:[body.token]; const targets=[...new Set(raw.filter(Boolean).map(String))].map((t)=>{const i=t.lastIndexOf(':');return {userId:t.slice(0,i),workDate:t.slice(i+1)};}).filter((t)=>t.userId&&validDate(t.workDate,'')); if(!targets.length)return {ok:true,changed:0,reviewed,reviewedAt:null,records:[]}; return database.transaction(async(tx)=>{const before=[];for(const t of targets){await allowedTarget(a,t.userId);before.push(await ensureDay(tx,t.userId,t.workDate));}const ids=before.map((r)=>r.id);const reviewedAt=reviewed?new Date().toISOString():null;const rows=(await tx.query("update public.attendance_days set reviewed_at=$2::timestamptz,reviewed_by=$3::uuid,updated_at=now() where id=any($1::uuid[]) returning *",[ids,reviewedAt,reviewed?a.id:null])).rows||[];for(const old of before){const after=rows.find((r)=>String(r.id)===String(old.id))||old;await audit(tx,old.id,reviewed?'reviewed':'returned',a.id,old,after,body.reason);}return {ok:true,changed:rows.length,reviewed,reviewedAt,records:rows.map((r)=>({id:r.id,user_id:r.user_id,work_date:r.work_date,reviewed:Boolean(r.reviewed_at),reviewedAt:r.reviewed_at||null}))};}); }
  async function history(employeeId,recordId) { const a=await reviewer(employeeId); if(!recordId)return {ok:true,logs:[]};const day=await database.one("select user_id from public.attendance_days where id=$1::uuid",[recordId]);if(!day)return {ok:true,logs:[]};await allowedTarget(a,day.user_id);const rows=(await database.query("select l.id,l.action,l.changed_by,l.before_data,l.after_data,l.reason,l.created_at,e.full_name as operator_name from public.attendance_audit_logs l left join public.set_employee e on e.id=l.changed_by where l.attendance_day_id=$1::uuid order by l.created_at desc",[recordId])).rows||[];return {ok:true,logs:rows}; }
  async function exportRows(employeeId,body={}) { const result=await reviewList(employeeId,{...body,status:'reviewed'},true); return {ok:true,rows:result.rows.map((row)=>{const leave=row.schedule?.leave_type_id?{code:row.schedule.leave_code,name:row.schedule.leave_name}:null;const rest=Boolean(row.shift&&(leave?.code==='0036'||leave?.code==='0047'||leave?.name==='例假'||leave?.name==='休息日'));return {work_date:row.work_date,employee_code:row.employee_code,employee_name:row.employee_name,regularHours:row.regularHours,overtimeHours:row.overtimeHours,clock_in_at:row.clock_in_at,clock_out_at:row.clock_out_at,note:row.note||"",restDayScheduled:rest,scheduledShiftStartTime:rest?row.shift.start_time||null:null,scheduledShiftEndTime:rest?row.shift.end_time||null:null};})}; }
  return Object.freeze({departmentSettings,today,clock,personalList,personalSave,reviewList,saveCommonNotes,reviewSave,reviewSet,history,exportRows});
}
module.exports={createNativeAttendance};
