-- 2026-09-25：恢復班表頁例假／休息日排班的加班匯出邏輯
-- 例休代碼 0036 / 0047 且同日有班別時，即使沒有明確 overtime_type_id，
-- 仍以班別上下班時間輸出加班；明確加班設定維持優先。

begin;

create or replace function public.get_schedule_export_rows_v2(p_start_date date,p_end_date date)
returns table(member_id uuid,employee_code text,employee_name text,home_department_id uuid,department_name text,pay_by_day boolean,work_date date,leave_type_id uuid,leave_code text,leave_name text,leave_all_day boolean,leave_start_time time,leave_end_time time,leave_reason text,overtime_type_id uuid,overtime_name text,overtime_start_time time,overtime_end_time time,overtime_use_rest_1 boolean,overtime_rest_1_start_time time,overtime_rest_1_end_time time,overtime_use_rest_2 boolean,overtime_rest_2_start_time time,overtime_rest_2_end_time time,overtime_reason text)
language plpgsql stable security definer set search_path=public,pg_catalog as $$
begin
  if not public.has_common_permission((select auth.uid()),'export') then
    raise exception '沒有匯出權限' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then
    raise exception '匯出日期範圍不正確';
  end if;
  if p_end_date-p_start_date>366 then
    raise exception '單次匯出期間不可超過 366 天';
  end if;
  return query
  select schedule.member_id,employee.employee_code,employee.full_name,employee.home_department_id,department.name,employee.pay_by_day,
    schedule.work_date,schedule.leave_type_id,leave_type.code,leave_type.name,schedule.leave_all_day,schedule.leave_start_time,
    schedule.leave_end_time,schedule.leave_reason,
    case
      when schedule.overtime_type_id is not null then schedule.overtime_type_id
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例','休','例假','休息日','休假','休假日'))
        then schedule.shift_type_id
      else null
    end,
    case
      when schedule.overtime_type_id is not null then overtime_type.name
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例','休','例假','休息日','休假','休假日'))
        then '例休排班'
      else null
    end,
    case
      when schedule.overtime_type_id is not null then schedule.overtime_start_time
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例','休','例假','休息日','休假','休假日'))
        then shift_type.start_time
      else null
    end,
    case
      when schedule.overtime_type_id is not null then schedule.overtime_end_time
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例','休','例假','休息日','休假','休假日'))
        then shift_type.end_time
      else null
    end,
    case when schedule.overtime_type_id is not null then schedule.overtime_use_rest_1 else false end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_1_start_time else null end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_1_end_time else null end,
    case when schedule.overtime_type_id is not null then schedule.overtime_use_rest_2 else false end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_2_start_time else null end,
    case when schedule.overtime_type_id is not null then schedule.overtime_rest_2_end_time else null end,
    case
      when schedule.overtime_type_id is not null then schedule.overtime_reason
      when schedule.shift_type_id is not null
       and (leave_type.code in ('0036','0047') or leave_type.name in ('例','休','例假','休息日','休假','休假日'))
        then '例假／休息日排班'
      else null
    end
  from public.schedule_entries schedule
  join public.set_employee employee on employee.id=schedule.member_id
  left join public.set_departments department on department.id=employee.home_department_id
  left join public.set_leave leave_type on leave_type.id=schedule.leave_type_id
  left join public.set_overtime overtime_type on overtime_type.id=schedule.overtime_type_id
  left join public.set_shift shift_type on shift_type.id=schedule.shift_type_id
  where schedule.work_date between p_start_date and p_end_date
    and public.has_group_permission((select auth.uid()),schedule.group_id,'schedule_view')
    and (schedule.leave_type_id is not null or schedule.overtime_type_id is not null)
  order by schedule.work_date,employee.sort_order,employee.full_name,employee.id;
end
$$;

revoke all on function public.get_schedule_export_rows_v2(date,date) from public,anon;
grant execute on function public.get_schedule_export_rows_v2(date,date) to authenticated,service_role;

commit;
