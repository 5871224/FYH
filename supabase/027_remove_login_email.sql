begin;

drop function if exists public.login_email_by_employee_code(text);

drop index if exists public.idx_set_employee_login_email_unique;

alter table if exists public.set_employee
  drop column if exists login_email;

commit;
