-- FYH private attendance attachments, restricted to a 20 GiB application quota.
insert into storage.buckets (id,name,public,file_size_limit)
values ('attendance-files','attendance-files',false,10485760)
on conflict (id) do update
set public=false,file_size_limit=10485760;

create table if not exists public.attendance_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.set_employee(id),
  work_date date not null,
  original_name text not null,
  description text not null default '',
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  storage_path text not null unique,
  status text not null default 'reserved' check (status in ('reserved','ready','deleted')),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.set_employee(id)
);
create index if not exists attendance_attachments_owner_date on public.attendance_attachments(owner_id,work_date,status);
create index if not exists attendance_attachments_status_created on public.attendance_attachments(status,created_at);
alter table public.attendance_attachments enable row level security;
revoke all on public.attendance_attachments from anon, authenticated;
grant select,insert,update on public.attendance_attachments to service_role;

create or replace function public.reserve_attendance_attachment(
  p_owner_id uuid, p_work_date date, p_original_name text, p_description text,
  p_mime_type text, p_size_bytes bigint, p_extension text
) returns public.attendance_attachments
language plpgsql security invoker set search_path=public,pg_temp
as $$
declare
  v_row public.attendance_attachments;
  v_usage bigint;
begin
  if p_owner_id is null or p_work_date is null or p_size_bytes < 1 or p_size_bytes > 10485760
    or length(p_original_name) not between 1 and 255 or length(p_description) > 1000
    or p_extension !~ '^[a-z0-9]{1,10}$' then
    raise exception '附件資料或檔案大小不符合限制';
  end if;
  perform pg_advisory_xact_lock(58720001);
  select coalesce(sum(size_bytes),0) into v_usage
  from public.attendance_attachments where status in ('reserved','ready');
  if v_usage + p_size_bytes > 21474836480 then
    raise exception '附件總容量已達 20 GB 上限';
  end if;
  v_row.id := gen_random_uuid();
  insert into public.attendance_attachments
    (id,owner_id,work_date,original_name,description,mime_type,size_bytes,storage_path)
  values (v_row.id,p_owner_id,p_work_date,p_original_name,p_description,p_mime_type,p_size_bytes,
          p_owner_id::text||'/'||p_work_date::text||'/'||v_row.id::text||'.'||p_extension)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.finish_attendance_attachment(p_id uuid,p_owner_id uuid)
returns public.attendance_attachments
language plpgsql security invoker set search_path=public,storage,pg_temp
as $$
declare
  v_row public.attendance_attachments;
  v_size bigint;
begin
  select * into v_row from public.attendance_attachments
  where id=p_id and owner_id=p_owner_id for update;
  if not found or v_row.status <> 'reserved' then raise exception '附件已完成或不存在'; end if;
  select (metadata->>'size')::bigint into v_size
  from storage.objects where bucket_id='attendance-files' and name=v_row.storage_path;
  if v_size is null or v_size < 1 or v_size > v_row.size_bytes then
    raise exception '附件尚未上傳成功或大小不符';
  end if;
  update public.attendance_attachments set status='ready',size_bytes=v_size,uploaded_at=now()
  where id=p_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.attachment_storage_usage()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object(
   'usedBytes', coalesce(sum(size_bytes) filter(where status='ready'),0),
   'reservedBytes', coalesce(sum(size_bytes) filter(where status='reserved'),0),
   'fileCount', count(*) filter(where status='ready'),
   'limitBytes',21474836480::bigint
 ) from public.attendance_attachments;
$$;
revoke all on function public.reserve_attendance_attachment(uuid,date,text,text,text,bigint,text) from public,anon,authenticated;
revoke all on function public.finish_attendance_attachment(uuid,uuid) from public,anon,authenticated;
revoke all on function public.attachment_storage_usage() from public,anon,authenticated;
grant execute on function public.reserve_attendance_attachment(uuid,date,text,text,text,bigint,text) to service_role;
grant execute on function public.finish_attendance_attachment(uuid,uuid) to service_role;
grant execute on function public.attachment_storage_usage() to service_role;
