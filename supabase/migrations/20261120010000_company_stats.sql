-- C-2: dashboard counts computed in the database. The REST API caps every select at 1000 rows, so counting
-- findings and employees client-side silently truncated big firms. security invoker: RLS still decides what is visible.
create function public.company_stats(p_org uuid, p_today date, p_company uuid default null)
returns table (company_id uuid, kind text, overdue boolean, n bigint)
language sql stable security invoker set search_path = ''
as $$
  select f.company_id, f.severity::text, f.due_date < p_today, count(*)
    from public.findings f
   where private.is_member(p_org) and f.org_id = p_org and f.status = 'open'
     and (p_company is null or f.company_id = p_company)
   group by f.company_id, f.severity, f.due_date < p_today
  union all
  select e.company_id, 'staff', false, count(*)
    from public.employees e
   where private.is_member(p_org) and e.org_id = p_org and e.archived_at is null
     and (p_company is null or e.company_id = p_company)
   group by e.company_id;
$$;
revoke all on function public.company_stats(uuid, date, uuid) from public, anon;
grant execute on function public.company_stats(uuid, date, uuid) to authenticated;
