import { withSupabase } from "npm:@supabase/server@^1";
import { actorIdOf,hasAnyGroupPermission,hasGroupPermission,isProfileEffective,isProfileEmployedOn,isUuid,pageNumber,validDate,taipeiDateString } from "../_shared/runtime.ts";

const BUCKET="attendance-files";
const MAX=10485760;
const MAX_BATCH=100;

async function actorOf(ctx:any) {
  const id=actorIdOf(ctx);
  const found=await ctx.supabaseAdmin.from("set_employee")
    .select("id,full_name,group_id,access_role_id,hire_date,leave_date,deleted_at,home_department:set_departments!home_department_id(hidden_from_schedule)")
    .eq("id",id).is("deleted_at",null).single();
  if(found.error)throw found.error;
  if(!isProfileEffective(found.data))
    throw new Error("此帳號目前無法使用附件功能");
  // 隱藏單位的管理員仍可依 attendance_review 群組權限審核其他員工附件。
  if(found.data.home_department?.hidden_from_schedule
    && !await hasAnyGroupPermission(ctx,id,"attendance_review"))
    throw new Error("此帳號目前無法使用附件功能");
  return found.data;
}
async function targetOf(ctx:any,userId:string){
  if(!isUuid(userId))throw new Error("人員識別碼錯誤");
  const r=await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,group_id,hire_date,leave_date,deleted_at,home_department:set_departments!home_department_id(hidden_from_schedule)")
    .eq("id",userId).single();
  if(r.error)throw r.error;
  if(r.data.home_department?.hidden_from_schedule)throw new Error("無法存取此人員的附件");
  return r.data;
}
async function authorize(ctx:any,actor:any,target:any,write=false){
  if(actor.id===target.id){
    if(write) return;
    return;
  }
  if(!await hasGroupPermission(ctx,actor.id,target.group_id,"attendance_review"))throw new Error("沒有該群組的附件權限");
}
async function canManage(ctx:any,actor:any){
  if(!await hasAnyGroupPermission(ctx,actor.id,"attendance_review"))throw new Error("沒有簽到審核權限");
}
async function unreviewed(ctx:any,ownerId:string,date:string){
  const r=await ctx.supabaseAdmin.from("attendance_days").select("reviewed_at")
    .eq("user_id",ownerId).eq("work_date",date).maybeSingle();
  if(r.error)throw r.error;
  if(r.data?.reviewed_at)throw new Error("該日期已審核，不能修改附件");
}
async function rowsForDay(ctx:any,ownerId:string,date:string){
  const r=await ctx.supabaseAdmin.from("attendance_attachments").select("id,owner_id,work_date,original_name,description,mime_type,size_bytes,created_at")
    .eq("owner_id",ownerId).eq("work_date",date).eq("status","ready")
    .order("created_at",{ascending:true});
  if(r.error)throw r.error;
  return r.data||[];
}
async function usage(ctx:any){
  const r=await ctx.supabaseAdmin.rpc("attachment_storage_usage");
  if(r.error)throw r.error;
  return r.data;
}
async function getRow(ctx:any,id:string){
  if(!isUuid(id))throw new Error("附件識別碼錯誤");
  const r=await ctx.supabaseAdmin.from("attendance_attachments").select("*")
    .eq("id",id).eq("status","ready").maybeSingle();
  if(r.error)throw r.error;
  if(!r.data)throw new Error("附件不存在或已刪除");
  return r.data;
}
async function groups(ctx:any,actor:any){
  await canManage(ctx,actor);
  const r=await ctx.supabaseAdmin.from("access_role_group_permissions")
    .select("group_id").eq("role_id",actor.access_role_id).contains("permissions",["attendance_review"]);
  if(r.error)throw r.error;
  return (r.data||[]).map((x:any)=>x.group_id);
}
async function managerList(ctx:any,actor:any,body:any){
  const groupIds=await groups(ctx,actor);
  const today=taipeiDateString();
  const from=validDate(body.fromDate,"2020-01-01"),to=validDate(body.toDate,today);
  if(from>to)throw new Error("日期範圍不正確");
  const page=pageNumber(body.page);
  const u=await usage(ctx);
  if(!groupIds.length)return {rows:[],total:0,page,pageSize:50,usage:u};
  const people=await ctx.supabaseAdmin.from("set_employee")
    .select("id,employee_code,full_name,home_department:set_departments!home_department_id(hidden_from_schedule)")
    .in("group_id",groupIds);
  if(people.error)throw people.error;
  const valid=(people.data||[]).filter((p:any)=>!p.home_department?.hidden_from_schedule);
  if(!valid.length)return {rows:[],total:0,page,pageSize:50,usage:u};
  const names=new Map(valid.map((p:any)=>[p.id,p]));
  const q=ctx.supabaseAdmin.from("attendance_attachments")
    .select("id,owner_id,work_date,original_name,description,mime_type,size_bytes,created_at",{count:"exact"})
    .eq("status","ready").in("owner_id",valid.map((p:any)=>p.id))
    .gte("work_date",from).lte("work_date",to)
    .order("work_date",{ascending:false}).order("created_at",{ascending:false})
    .range((page-1)*50,page*50-1);
  const r=await q;
  if(r.error)throw r.error;
  return {rows:(r.data||[]).map((x:any)=>({...x,employee_name:names.get(x.owner_id)?.full_name||"",employee_code:names.get(x.owner_id)?.employee_code||""})),total:r.count||0,page,pageSize:50,usage:u};
}
async function countRows(ctx:any,actor:any,body:any){
  const dates=Array.isArray(body.days)?body.days.slice(0,100):[];
  const list=dates.filter((p:any)=>isUuid(p.ownerId)&&/^\d{4}-\d{2}-\d{2}$/.test(p.date));
  if(!list.length)return {counts:{}};
  const other=list.some((d:any)=>d.ownerId!==actor.id);
  if(other)await canManage(ctx,actor);
  const targetIds=[...new Set(list.map((p:any)=>p.ownerId))];
  const permittedGroups=other?await groups(ctx,actor):[];
  const people=await ctx.supabaseAdmin.from("set_employee")
    .select("id,group_id,deleted_at,home_department:set_departments!home_department_id(hidden_from_schedule)")
    .in("id",targetIds);
  if(people.error)throw people.error;
  const targets=new Map((people.data||[]).map((p:any)=>[p.id,p]));
  for(const id of targetIds){
    const p:any=targets.get(id);
    if(!p||p.deleted_at||p.home_department?.hidden_from_schedule
      ||(id!==actor.id&&!permittedGroups.includes(p.group_id)))throw new Error("沒有該人員的附件權限");
  }
  const min=list.map((d:any)=>d.date).sort()[0],max=list.map((d:any)=>d.date).sort().at(-1);
  const r=await ctx.supabaseAdmin.from("attendance_attachments").select("owner_id,work_date")
    .in("owner_id",targetIds).gte("work_date",min).lte("work_date",max).eq("status","ready");
  if(r.error)throw r.error;
  const allow=new Set(list.map((d:any)=>d.ownerId+":"+d.date));
  const counts:Record<string,number>={};
  for(const row of r.data||[]){const key=row.owner_id+":"+row.work_date;if(allow.has(key))counts[key]=(counts[key]||0)+1;}
  return {counts};
}
function safeType(v:string){
  const allowed=["image/jpeg","image/png","image/webp","image/gif","image/heic","image/heif","application/pdf",
    "text/plain","text/csv","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/zip"];
  return allowed.includes(v.toLowerCase());
}
async function cleanupExpiredReservations(ctx:any){
  // Signed upload URLs expire after two hours. Reclaim abandoned reservations after three.
  const expiration=new Date(Date.now()-3*60*60*1000).toISOString();
  const pending=await ctx.supabaseAdmin.from("attendance_attachments").select("id,storage_path")
    .eq("status","reserved").lt("created_at",expiration).limit(100);
  if(pending.error)throw pending.error;
  for(const row of pending.data||[]){
    const removed=await ctx.supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
    if(removed.error)continue;
    const released=await ctx.supabaseAdmin.from("attendance_attachments")
      .update({status:"deleted",deleted_at:new Date().toISOString()})
      .eq("id",row.id).eq("status","reserved");
    if(released.error)throw released.error;
  }
}
async function reserve(ctx:any,actor:any,body:any){
  await cleanupExpiredReservations(ctx);
  const date=String(body.workDate||""),name=String(body.name||"").trim();
  const size=Number(body.size),mime=String(body.mime||"").toLowerCase();
  const ext=name.split(".").pop()?.toLowerCase()||"";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!isProfileEmployedOn(actor,date)||date>taipeiDateString())
    throw new Error("上傳日期無效");
  if(!Number.isInteger(size)||size<1||size>MAX||name.length>255||!safeType(mime)
    ||!/^[a-z0-9]{1,10}$/.test(ext)||/^(exe|html|htm|svg|js|bat|cmd|ps1|sh|msi|apk|php)$/i.test(ext))
    throw new Error("不支援此檔案類型或檔案超過 10 MB");
  await unreviewed(ctx,actor.id,date);
  const r=await ctx.supabaseAdmin.rpc("reserve_attendance_attachment",{
    p_owner_id:actor.id,p_work_date:date,p_original_name:name,
    p_description:String(body.description||"").trim(),p_mime_type:mime,p_size_bytes:size,p_extension:ext
  });
  if(r.error)throw r.error;
  const row=r.data;
  const signed=await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(row.storage_path);
  if(signed.error){
    await ctx.supabaseAdmin.from("attendance_attachments").update({status:"deleted",deleted_at:new Date().toISOString(),deleted_by:actor.id}).eq("id",row.id).eq("status","reserved");
    throw signed.error;
  }
  return {id:row.id,path:row.storage_path,token:signed.data.token,signedUrl:signed.data.signedUrl};
}
async function finish(ctx:any,actor:any,body:any){
  const id=String(body.id||"");
  if(!isUuid(id))throw new Error("附件識別碼錯誤");
  const row=await ctx.supabaseAdmin.from("attendance_attachments").select("*").eq("id",id).eq("owner_id",actor.id).eq("status","reserved").single();
  if(row.error)throw row.error;
  await unreviewed(ctx,actor.id,row.data.work_date);
  const r=await ctx.supabaseAdmin.rpc("finish_attendance_attachment",{p_id:id,p_owner_id:actor.id});
  if(r.error)throw r.error;
  return {ok:true,id};
}
async function view(ctx:any,actor:any,body:any){
  const row=await getRow(ctx,String(body.id||""));
  const target=await targetOf(ctx,row.owner_id);
  await authorize(ctx,actor,target);
  const inline=/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(row.mime_type);
  const signed=await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUrl(row.storage_path,120,inline?{}:{download:row.original_name});
  if(signed.error)throw signed.error;
  return {url:signed.data.signedUrl,name:row.original_name,mime:row.mime_type};
}
async function edit(ctx:any,actor:any,body:any){
  const row=await getRow(ctx,String(body.id||""));
  if(row.owner_id!==actor.id)throw new Error("只能編輯自己的附件");
  await unreviewed(ctx,actor.id,row.work_date);
  const description=String(body.description||"").trim();
  if(description.length>1000)throw new Error("說明文字太長");
  const r=await ctx.supabaseAdmin.from("attendance_attachments").update({description}).eq("id",row.id).eq("status","ready");
  if(r.error)throw r.error;
  return {ok:true};
}
async function remove(ctx:any,actor:any,body:any){
  const ids=[...new Set((Array.isArray(body.ids)?body.ids:[]).map(String))].slice(0,MAX_BATCH);
  if(!ids.length)throw new Error("請先勾選檔案");
  const outcomes=[];
  for(const id of ids){
    try {
      const row=await getRow(ctx,id);
      if(row.owner_id===actor.id){
        const privileged=await hasGroupPermission(ctx,actor.id,(await targetOf(ctx,row.owner_id)).group_id,"attendance_review");
        if(!privileged)await unreviewed(ctx,actor.id,row.work_date);
      }else{
        const target=await targetOf(ctx,row.owner_id);
        if(!await hasGroupPermission(ctx,actor.id,target.group_id,"attendance_review"))throw new Error("沒有刪除權限");
      }
      const deleted=await ctx.supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
      if(deleted.error)throw deleted.error;
      const updated=await ctx.supabaseAdmin.from("attendance_attachments").update({
        status:"deleted",deleted_at:new Date().toISOString(),deleted_by:actor.id
      }).eq("id",id).eq("status","ready");
      if(updated.error)throw updated.error;
      outcomes.push({id,ok:true});
    }catch(e){outcomes.push({id,ok:false,error:e instanceof Error?e.message:"刪除失敗"});}
  }
  return {results:outcomes,usage:await usage(ctx)};
}
export default {
  fetch:withSupabase({auth:"user"},async(req,ctx)=>{
    if(req.method!=="POST")return Response.json({message:"Method Not Allowed"},{status:405});
    try{
      const body=await req.json(),actor=await actorOf(ctx);
      switch(body.action){
        case "day":{const ownerId=String(body.ownerId||actor.id),date=String(body.workDate||"");
          if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("附件日期不正確");
          const target=await targetOf(ctx,ownerId);await authorize(ctx,actor,target);
          // Whether attachments are editable is authoritative on the server; viewing a day does
          // not depend on which tab was previously rendered in the browser.
          const review=await ctx.supabaseAdmin.from("attendance_days").select("reviewed_at")
            .eq("user_id",ownerId).eq("work_date",date).maybeSingle();
          if(review.error)throw review.error;
          const canEdit=ownerId===actor.id&&!review.data?.reviewed_at
            &&isProfileEmployedOn(actor,date)&&date<=taipeiDateString();
          return Response.json({rows:await rowsForDay(ctx,ownerId,date),canEdit});}
        case "counts":return Response.json(await countRows(ctx,actor,body));
        case "manager_list":return Response.json(await managerList(ctx,actor,body));
        case "usage":await canManage(ctx,actor);return Response.json(await usage(ctx));
        case "reserve":return Response.json(await reserve(ctx,actor,body));
        case "finish":return Response.json(await finish(ctx,actor,body));
        case "view":return Response.json(await view(ctx,actor,body));
        case "edit":return Response.json(await edit(ctx,actor,body));
        case "delete":return Response.json(await remove(ctx,actor,body));
        default:return Response.json({message:"不支援的附件操作"},{status:400});
      }
    }catch(e){return Response.json({message:e instanceof Error?e.message:"附件操作失敗"},{status:400});}
  })
};
