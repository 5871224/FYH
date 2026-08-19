-- ============================================================================================
-- 排班條件：同班限制／同休限制（只約束自動排班）
-- ============================================================================================

begin;

create table if not exists public.schedule_conditions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.schedule_groups(id) on delete cascade,
  condition_type text not null check (condition_type in ('same_shift','same_leave')),
  limit_count integer not null check (limit_count >= 1),
  member_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schedule_conditions_group_type
  on public.schedule_conditions(group_id,condition_type,id);

alter table public.schedule_conditions enable row level security;
revoke all privileges on table public.schedule_conditions from public,anon,authenticated;
grant all privileges on table public.schedule_conditions to service_role;

create or replace function public.get_schedule_conditions_v1(p_group_id uuid)
returns table(
  id uuid,
  group_id uuid,
  condition_type text,
  limit_count integer,
  member_ids uuid[]
)
language plpgsql
stable
security definer
set search_path=public,pg_catalog
as $$
begin
  if p_group_id is null or not public.can_access_group(auth.uid(),p_group_id,'schedule_manage') then
    raise exception '沒有管理此群組排班條件的權限' using errcode='42501';
  end if;

  return query
  select condition.id,condition.group_id,condition.condition_type,condition.limit_count,condition.member_ids
  from public.schedule_conditions condition
  where condition.group_id=p_group_id
  order by condition.created_at,condition.id;
end
$$;

create or replace function public.save_schedule_condition_v1(p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_id uuid;
  v_group_id uuid;
  v_type text;
  v_limit integer;
  v_member_ids uuid[];
  v_member_count integer;
begin
  begin
    v_id:=nullif(btrim(coalesce(p_item->>'id','')),'')::uuid;
  exception when invalid_text_representation then
    raise exception '排班條件識別碼格式錯誤';
  end;
  if v_id is null then
    v_id:=gen_random_uuid();
  end if;

  begin
    v_group_id:=nullif(btrim(coalesce(p_item->>'groupId','')),'')::uuid;
  exception when invalid_text_representation then
    raise exception '群組識別碼格式錯誤';
  end;
  if v_group_id is null or not public.can_access_group(auth.uid(),v_group_id,'schedule_manage') then
    raise exception '沒有管理此群組排班條件的權限' using errcode='42501';
  end if;

  v_type:=lower(btrim(coalesce(p_item->>'type','')));
  if v_type not in ('same_shift','same_leave') then
    raise exception '不支援的排班條件類型';
  end if;

  begin
    v_limit:=(p_item->>'limitCount')::integer;
  exception when invalid_text_representation then
    raise exception '限額格式錯誤';
  end;

  begin
    select coalesce(array_agg(member_id order by member_id),'{}'::uuid[])
    into v_member_ids
    from (
      select distinct value::uuid as member_id
      from jsonb_array_elements_text(coalesce(p_item->'memberIds','[]'::jsonb))
      where nullif(btrim(value),'') is not null
    ) members;
  exception when invalid_text_representation then
    raise exception '人員識別碼格式錯誤';
  end;

  v_member_count:=coalesce(array_length(v_member_ids,1),0);
  if v_member_count<2 then
    raise exception '至少選擇 2 位人員';
  end if;
  if v_limit is null or v_limit<1 or v_limit>=v_member_count then
    raise exception '限額必須大於等於 1，且小於選取人數';
  end if;

  insert into public.schedule_conditions(id,group_id,condition_type,limit_count,member_ids)
  values(v_id,v_group_id,v_type,v_limit,v_member_ids)
  on conflict(id) do update set
    group_id=excluded.group_id,
    condition_type=excluded.condition_type,
    limit_count=excluded.limit_count,
    member_ids=excluded.member_ids,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'id',v_id,
    'groupId',v_group_id,
    'type',v_type,
    'limitCount',v_limit,
    'memberIds',to_jsonb(v_member_ids)
  );
end
$$;

create or replace function public.delete_schedule_condition_v1(p_condition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_group_id uuid;
begin
  if p_condition_id is null then
    raise exception '缺少排班條件識別碼';
  end if;

  select group_id into v_group_id
  from public.schedule_conditions
  where id=p_condition_id;

  if not found then
    return jsonb_build_object('ok',true,'deleted',false);
  end if;

  if not public.can_access_group(auth.uid(),v_group_id,'schedule_manage') then
    raise exception '沒有管理此群組排班條件的權限' using errcode='42501';
  end if;

  delete from public.schedule_conditions where id=p_condition_id;
  return jsonb_build_object('ok',true,'deleted',true,'id',p_condition_id);
end
$$;

revoke all on function public.get_schedule_conditions_v1(uuid) from public,anon;
revoke all on function public.save_schedule_condition_v1(jsonb) from public,anon;
revoke all on function public.delete_schedule_condition_v1(uuid) from public,anon;

grant execute on function public.get_schedule_conditions_v1(uuid) to authenticated,service_role;
grant execute on function public.save_schedule_condition_v1(jsonb) to authenticated,service_role;
grant execute on function public.delete_schedule_condition_v1(uuid) to authenticated,service_role;

commit;
