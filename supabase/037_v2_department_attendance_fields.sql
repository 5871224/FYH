begin;

do $$
begin
  if to_regclass('public.department_attendance_settings') is not null then
    update public.set_departments d
    set public_ip = s.public_ip
    from public.department_attendance_settings s
    where s.department_id = d.id
      and nullif(btrim(coalesce(s.public_ip, '')), '') is not null;
  end if;
end $$;

drop function if exists public.get_department_attendance_settings();
drop function if exists public.save_department_attendance_settings_bulk(jsonb);

drop trigger if exists protect_department_attendance_settings_trigger on public.set_departments;
drop function if exists public.protect_department_attendance_settings();

create or replace function public.save_department_attendance_fields_bulk(settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;
  if settings is null or jsonb_typeof(settings) <> 'array' then
    raise exception 'settings must be a json array' using errcode = '22023';
  end if;

  update public.set_departments d
  set
    address = nullif(btrim(coalesce(item.address, '')), ''),
    latitude = item.latitude,
    longitude = item.longitude,
    public_ip = nullif(btrim(coalesce(item.public_ip, '')), ''),
    attendance_enabled = coalesce(item.attendance_enabled, false),
    attendance_settings_updated_at = now(),
    attendance_settings_updated_by = auth.uid()
  from jsonb_to_recordset(settings) as item(
    department_id uuid,
    address text,
    latitude double precision,
    longitude double precision,
    public_ip text,
    attendance_enabled boolean
  )
  where item.department_id is not null
    and d.id = item.department_id;
end;
$$;

revoke all on function public.save_department_attendance_fields_bulk(jsonb) from public, anon;
grant execute on function public.save_department_attendance_fields_bulk(jsonb) to authenticated;

do $$
begin
  if to_regclass('public.department_attendance_settings') is not null then
    execute 'drop policy if exists read_department_attendance_settings on public.department_attendance_settings';
    execute 'drop policy if exists write_department_attendance_settings on public.department_attendance_settings';
    execute 'drop table public.department_attendance_settings';
  end if;
end $$;

commit;
