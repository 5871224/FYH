begin;

create or replace function public.replace_access_role_group_permissions_v1(
  p_role_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_role_id is null then
    raise exception '角色識別碼不可空白' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception '群組權限格式錯誤' using errcode = '22023';
  end if;

  -- 同一角色的整組權限替換必須序列化，避免兩個儲存請求同時 delete/insert。
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_role_id::text, 0));

  if not exists (select 1 from public.access_roles where id = p_role_id) then
    raise exception '角色不存在' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as item("groupId" uuid, permissions text[])
    left join public.schedule_groups g
      on g.id = item."groupId" and g.deleted_at is null
    where item."groupId" is null
       or g.id is null
       or item.permissions is null
  ) then
    raise exception '群組權限包含不存在的群組' using errcode = '22023';
  end if;

  delete from public.access_role_group_permissions
  where role_id = p_role_id;

  insert into public.access_role_group_permissions(role_id, group_id, permissions, updated_at)
  select p_role_id, item."groupId", item.permissions, now()
  from jsonb_to_recordset(p_rows) as item("groupId" uuid, permissions text[])
  where cardinality(coalesce(item.permissions, '{}'::text[])) > 0;
end;
$$;

revoke all on function public.replace_access_role_group_permissions_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_access_role_group_permissions_v1(uuid,jsonb) to service_role;

commit;
