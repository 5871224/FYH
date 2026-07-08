create unique index if not exists set_employee_employee_code_lower_key
on public.set_employee ((lower(btrim(employee_code))));
