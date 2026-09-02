begin;

-- Canonical authorization predicates are internal implementation details.
-- PostgreSQL grants EXECUTE to PUBLIC by default, so revoke that implicit exposure.
revoke execute on function public.role_has_common_permission(uuid,text) from public,anon,authenticated;
revoke execute on function public.role_has_group_permission(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.role_has_any_group_permission(uuid,text) from public,anon,authenticated;

grant execute on function public.role_has_common_permission(uuid,text) to service_role;
grant execute on function public.role_has_group_permission(uuid,uuid,text) to service_role;
grant execute on function public.role_has_any_group_permission(uuid,text) to service_role;

-- These predicates are evaluated directly by authenticated RLS policies.
-- Keep authenticated access, but remove anonymous/PUBLIC execution.
revoke execute on function public.has_common_permission(uuid,text) from public,anon;
revoke execute on function public.has_group_permission(uuid,uuid,text) from public,anon;
revoke execute on function public.has_any_group_permission(uuid,text) from public,anon;
revoke execute on function public.has_group_access(uuid,uuid) from public,anon;

grant execute on function public.has_common_permission(uuid,text) to authenticated,service_role;
grant execute on function public.has_group_permission(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.has_any_group_permission(uuid,text) to authenticated,service_role;
grant execute on function public.has_group_access(uuid,uuid) to authenticated,service_role;

commit;
