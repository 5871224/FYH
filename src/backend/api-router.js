const { CONTRACT_VERSION, ROUTES, findRoute } = require("./api-contract");
const { BackendError, normalizeBackendError } = require("./errors");
const { getSessionIdleMs, normalizeDeviceType } = require("./session-store");

const SESSION_COOKIE_NAME = "fyh_session";
const MAX_JSON_BYTES = 64 * 1024;
const MAX_SCHEDULE_JSON_BYTES = 2 * 1024 * 1024;

function parseCookies(headerValue){return String(headerValue||"").split(";").map((p)=>p.trim()).filter(Boolean).reduce((out,p)=>{const i=p.indexOf("=");if(i>0)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim());return out;},{});}
function formatSessionCookie(sessionId,options={}){const parts=[`${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId||"")}`,"Path=/","HttpOnly","SameSite=Lax"];if(options.secure)parts.push("Secure");if(options.clear){parts.push("Max-Age=0","Expires=Thu, 01 Jan 1970 00:00:00 GMT");}else if(normalizeDeviceType(options.deviceType)==="phone")parts.push(`Max-Age=${Math.floor(getSessionIdleMs("phone")/1000)}`);return parts.join("; ");}
function sendJson(response,statusCode,payload,headers={}){response.writeHead(statusCode,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers});response.end(JSON.stringify(payload));}
async function readJson(request,maxBytes=MAX_JSON_BYTES){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>maxBytes)throw new BackendError(413,"REQUEST_TOO_LARGE","請求內容過大");chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new BackendError(400,"INVALID_JSON","JSON 格式錯誤");}}
function sanitizeAuthContext(context){const raw=context?.user&&typeof context.user==="object"?context.user:null;const user=raw?.id?{id:String(raw.id),email:String(raw.email||"")}:null;return{authenticated:Boolean(user),user,profile:user&&context?.profile&&typeof context.profile==="object"?{...context.profile}:null};}
function detectDeviceType(request,body={}){const explicit=normalizeDeviceType(body.deviceType||request.headers["x-fyh-device"]);if(body.deviceType||request.headers["x-fyh-device"])return explicit;const ua=String(request.headers["user-agent"]||"");if(/iPad|Tablet|Silk|Android(?!.*Mobile)/i.test(ua))return"tablet";return/iPhone|iPod|Android.*Mobile|Windows Phone|Mobi|Mobile/i.test(ua)?"phone":"desktop";}

function createApiRouter(options={}){
  const provider=options.provider,sessionStore=options.sessionStore,services=options.services||{},secureCookies=Boolean(options.secureCookies);
  if(!provider||!sessionStore)throw new Error("createApiRouter requires provider and sessionStore");
  const featureErrors={
    schedule:["SCHEDULE_SERVICE_UNAVAILABLE","班表 Backend Service 尚未啟用"],
    settings:["SETTINGS_SERVICE_UNAVAILABLE","設定 Backend Service 尚未啟用"],
    masterData:["MASTER_DATA_SERVICE_UNAVAILABLE","主檔 Backend Service 尚未啟用"],
    members:["MEMBER_SERVICE_UNAVAILABLE","人員 Backend Service 尚未啟用"],
    groupRoles:["GROUP_ROLE_SERVICE_UNAVAILABLE","群組與角色 Backend Service 尚未啟用"],
    archives:["ARCHIVE_API_UNAVAILABLE","班表封存功能尚未啟用"],
    scheduleExtra:["SCHEDULE_EXTRA_API_UNAVAILABLE","班表附加功能尚未啟用"],
    attendance:["ATTENDANCE_API_UNAVAILABLE","簽到功能尚未啟用"],
    meal:["MEAL_API_UNAVAILABLE","訂餐功能尚未啟用"]
  };
  const feature=(name,method)=>{const item=services[name];if(!item||typeof item[method]!=="function"){const [code,message]=featureErrors[name]||["BACKEND_FEATURE_UNAVAILABLE","功能尚未啟用"];throw new BackendError(503,code,message);}return item;};
  const cleared=()=>({"Set-Cookie":formatSessionCookie("",{clear:true,secure:secureCookies})});
  const cookie=(id,record)=>({"Set-Cookie":formatSessionCookie(id,{deviceType:record.deviceType,secure:secureCookies})});
  async function session(request){const id=parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME]||"";const record=id?await sessionStore.read(id):null;if(!id||!record)throw new BackendError(401,"AUTH_REQUIRED","請先登入");return{id,record};}
  async function active(request){const {id,record}=await session(request);const context=await provider.getAuthContext(record.payload.providerSession);await sessionStore.update(id,{providerSession:context.providerSession,user:context.user,profile:context.profile});await sessionStore.touch(id);if(!context?.user?.id)throw new BackendError(401,"AUTH_REQUIRED","請先登入");return{id,record,context};}
  const reply=(response,data,state,status=200,headers={})=>sendJson(response,status,data,state?{...cookie(state.id,state.record),...headers}:headers);

  async function authSignIn(request,response){const body=await readJson(request);const context=await provider.signIn({loginAccount:body.loginAccount,password:body.password});const deviceType=detectDeviceType(request,body);const record=await sessionStore.create({providerSession:context.providerSession,user:context.user,profile:context.profile},{deviceType});sendJson(response,200,sanitizeAuthContext(context),{"Set-Cookie":formatSessionCookie(record.id,{deviceType,secure:secureCookies})});}
  async function authContext(request,response){const s=await active(request);reply(response,sanitizeAuthContext(s.context),s);}
  async function authSignOut(request,response){const s=await session(request);try{await provider.signOut(s.record.payload.providerSession);}finally{await sessionStore.remove(s.id);}sendJson(response,200,sanitizeAuthContext(null),cleared());}
  async function authPassword(request,response){const s=await session(request),body=await readJson(request);const result=await provider.changePassword(s.record.payload.providerSession,body.newPassword);if(result?.providerSession)await sessionStore.update(s.id,{...s.record.payload,providerSession:result.providerSession});await sessionStore.touch(s.id);sendJson(response,200,{ok:true},cookie(s.id,s.record));}
  async function withActive(request,response,name,method,args,bodyLimit=MAX_JSON_BYTES){const s=await active(request);const api=feature(name,method);const data=await args(api,s,bodyLimit);reply(response,data,s);}

  const handlers={
    health:async(_q,r)=>{let health={ready:false};try{health=await provider.health();}catch{}sendJson(r,200,{ok:true,service:"fyh-api",contractVersion:CONTRACT_VERSION,ready:health?.ready===true});},
    authSignIn,authContext,authSignOut,authPassword,
    scheduleBootstrap:(q,r,u)=>withActive(q,r,"schedule","getBootstrap",(a,s)=>a.getBootstrap(s.context.user.id,u.searchParams.get("documentId")||"default")),
    scheduleEntries:(q,r,u)=>withActive(q,r,"schedule","getEntries",(a,s)=>a.getEntries(s.context.user.id,u.searchParams.get("startDate"),u.searchParams.get("endDate"),{offset:u.searchParams.get("offset"),limit:u.searchParams.get("limit")})),
    scheduleEntriesSave:(q,r)=>withActive(q,r,"schedule","saveEntries",async(a,s)=>a.saveEntries(s.context.user.id,(await readJson(q,MAX_SCHEDULE_JSON_BYTES)).entries)),
    schedulePreferencesSave:(q,r)=>withActive(q,r,"settings","saveSchedulerPreferences",async(a,s)=>{const b=await readJson(q);return a.saveSchedulerPreferences(s.context.user.id,b.documentId||"default",b.settings);}),
    scheduleArchives:(q,r,u)=>withActive(q,r,"archives","list",(a,s)=>a.list(s.context.user.id,u.searchParams.get("groupId")||"")),
    scheduleArchiveEntries:(q,r,u)=>withActive(q,r,"archives","entries",(a,s)=>a.entries(s.context.user.id,u.searchParams.get("archiveId"))),
    scheduleArchiveCreate:(q,r)=>withActive(q,r,"archives","archive",async(a,s)=>{const b=await readJson(q);return a.archive(s.context.user.id,b.groupId,b.startDate,b.endDate);}),
    scheduleArchiveUnarchive:(q,r)=>withActive(q,r,"archives","unarchive",async(a,s)=>a.unarchive(s.context.user.id,(await readJson(q)).archiveId)),
    scheduleHolidaysSave:(q,r)=>withActive(q,r,"scheduleExtra","saveHolidays",async(a,s)=>a.saveHolidays(s.context.user.id,(await readJson(q)).holidays)),
    scheduleExportRows:(q,r,u)=>withActive(q,r,"scheduleExtra","exportRows",(a,s)=>a.exportRows(s.context.user.id,u.searchParams.get("startDate"),u.searchParams.get("endDate"))),

    attendanceDepartmentSettings:(q,r)=>withActive(q,r,"attendance","departmentSettings",(a,s)=>a.departmentSettings(s.context.user.id)),
    attendanceToday:(q,r)=>withActive(q,r,"attendance","today",(a,s)=>a.today(s.context.user.id)),
    attendanceClock:(q,r)=>withActive(q,r,"attendance","clock",async(a,s)=>a.clock(s.context.user.id,await readJson(q),q.headers)),
    attendancePersonalList:(q,r)=>withActive(q,r,"attendance","personalList",async(a,s)=>a.personalList(s.context.user.id,await readJson(q))),
    attendancePersonalSave:(q,r)=>withActive(q,r,"attendance","personalSave",async(a,s)=>a.personalSave(s.context.user.id,await readJson(q))),
    attendanceReviewList:(q,r)=>withActive(q,r,"attendance","reviewList",async(a,s)=>a.reviewList(s.context.user.id,await readJson(q))),
    attendanceCommonNotes:(q,r)=>withActive(q,r,"attendance","saveCommonNotes",async(a,s)=>a.saveCommonNotes(s.context.user.id,await readJson(q))),
    attendanceReviewSave:(q,r)=>withActive(q,r,"attendance","reviewSave",async(a,s)=>a.reviewSave(s.context.user.id,await readJson(q))),
    attendanceReviewSet:(q,r)=>withActive(q,r,"attendance","reviewSet",async(a,s)=>a.reviewSet(s.context.user.id,await readJson(q))),
    attendanceHistory:(q,r,u)=>withActive(q,r,"attendance","history",(a,s)=>a.history(s.context.user.id,u.searchParams.get("recordId"))),
    attendanceExport:(q,r)=>withActive(q,r,"attendance","exportRows",async(a,s)=>a.exportRows(s.context.user.id,await readJson(q))),

    mealToday:(q,r)=>withActive(q,r,"meal","todayStatus",(a,s)=>a.todayStatus(s.context.user.id)),
    mealSave:(q,r)=>withActive(q,r,"meal","save",async(a,s)=>a.save(s.context.user.id,await readJson(q))),
    mealCancel:(q,r)=>withActive(q,r,"meal","cancel",(a,s)=>a.cancel(s.context.user.id)),
    mealAdminSettings:(q,r)=>withActive(q,r,"meal","adminSettings",(a,s)=>a.adminSettings(s.context.user.id)),
    mealAdminSettingsSave:(q,r)=>withActive(q,r,"meal","saveAdminSettings",async(a,s)=>a.saveAdminSettings(s.context.user.id,await readJson(q))),
    mealProductDelete:(q,r)=>withActive(q,r,"meal","deleteProduct",async(a,s)=>a.deleteProduct(s.context.user.id,(await readJson(q)).productId)),
    mealReport:(q,r)=>withActive(q,r,"meal","report",async(a,s)=>a.report(s.context.user.id,await readJson(q))),

    settingsReorder:(q,r)=>withActive(q,r,"settings","reorderSettings",async(a,s)=>{const b=await readJson(q);return a.reorderSettings(s.context.user.id,b.category,b.ids);}),
    departmentSave:(q,r)=>withActive(q,r,"masterData","saveDepartment",async(a,s)=>a.saveDepartment(s.context.user.id,(await readJson(q)).department)),
    departmentDelete:(q,r)=>withActive(q,r,"masterData","deleteDepartment",async(a,s)=>a.deleteDepartment(s.context.user.id,(await readJson(q)).departmentId)),
    shiftSave:(q,r)=>withActive(q,r,"masterData","saveShift",async(a,s)=>a.saveShift(s.context.user.id,(await readJson(q)).shift)),
    catalogSave:(q,r)=>withActive(q,r,"masterData","saveCatalogItem",async(a,s)=>{const b=await readJson(q);return a.saveCatalogItem(s.context.user.id,b.category,b.item);}),
    catalogDelete:(q,r)=>withActive(q,r,"masterData","deleteCatalogItem",async(a,s)=>{const b=await readJson(q);return a.deleteCatalogItem(s.context.user.id,b.category,b.itemId);}),
    membersDirectory:(q,r)=>withActive(q,r,"members","getDirectory",(a,s)=>a.getDirectory(s.context.user.id)),
    memberSave:(q,r)=>withActive(q,r,"members","saveMember",async(a,s)=>{const b=await readJson(q);return a.saveMember(s.context.user.id,b.member,b.previousEmployeeCode);}),
    memberGroupChangeValidate:(q,r)=>withActive(q,r,"members","validateGroupChange",async(a,s)=>{const b=await readJson(q);return a.validateGroupChange(s.context.user.id,b.employeeCode,b.newGroupId||b.groupId);}),
    memberPasswordReset:async(q,r)=>{const s=await active(q),a=feature("members","resetPassword"),b=await readJson(q),result=await a.resetPassword(s.context.user.id,b.employeeCode,b.password);sendJson(r,200,result,result?.selfReset?cleared():cookie(s.id,s.record));},
    memberDelete:async(q,r)=>{const s=await active(q),a=feature("members","deleteMember"),b=await readJson(q),result=await a.deleteMember(s.context.user.id,b.employeeCode,b.currentPassword);sendJson(r,200,result,result?.selfDelete?cleared():cookie(s.id,s.record));},
    accessBundle:(q,r)=>withActive(q,r,"groupRoles","getAccessBundle",(a,s)=>a.getAccessBundle(s.context.user.id)),
    groupSave:(q,r)=>withActive(q,r,"groupRoles","saveGroup",async(a,s)=>a.saveGroup(s.context.user.id,(await readJson(q)).group)),
    groupDelete:(q,r)=>withActive(q,r,"groupRoles","deleteGroup",async(a,s)=>{const b=await readJson(q);return a.deleteGroup(s.context.user.id,b.groupId,b.confirmName);}),
    groupsReorder:(q,r)=>withActive(q,r,"groupRoles","reorderGroups",async(a,s)=>{const b=await readJson(q);return a.reorderGroups(s.context.user.id,b.groupIds||b.ids);}),
    accessRoleSave:(q,r)=>withActive(q,r,"groupRoles","saveRole",async(a,s)=>a.saveRole(s.context.user.id,(await readJson(q)).role)),
    accessRoleDelete:(q,r)=>withActive(q,r,"groupRoles","deleteRole",async(a,s)=>a.deleteRole(s.context.user.id,(await readJson(q)).roleId))
  };

  return Object.freeze({
    routes:ROUTES,
    async handle(request,response,url){const match=findRoute(request.method,url.pathname);if(!match){if(url.pathname.startsWith("/api/")){sendJson(response,404,{error:{code:"API_ROUTE_NOT_FOUND",message:"API 路徑不存在"}});return true;}return false;}const [name]=match;try{await handlers[name](request,response,url);}catch(error){const normalized=normalizeBackendError(error);sendJson(response,normalized.statusCode,{error:{code:normalized.code,message:normalized.message}},normalized.statusCode===401?cleared():{});}return true;}
  });
}

module.exports={SESSION_COOKIE_NAME,parseCookies,formatSessionCookie,sanitizeAuthContext,detectDeviceType,createApiRouter};
