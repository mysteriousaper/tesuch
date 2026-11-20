-- Privacy mode "code instead of name".
-- * orgs.privacy_mode: per-firm switch. Changed only through the existing owner-only orgs_update policy
--   (no new policy and no new grant, so accountants, viewers and other firms still cannot touch it).
-- * employees.employee_code: optional code (e.g. EMP-014), unique per company. When privacy mode is on the
--   application sets full_name = employee_code, so every existing display shows the code and no name is stored.
alter table public.orgs
  add column privacy_mode boolean not null default false;

alter table public.employees
  add column employee_code text check (length(trim(employee_code)) between 1 and 40);

create unique index employees_company_employee_code_key
  on public.employees (company_id, employee_code)
  where employee_code is not null;

-- orgs has no audit trigger of its own (its rows have no org_id column), so log privacy mode changes explicitly.
-- Owners read the entry in the audit log like any other (org_id = the org itself).
create function private.audit_org_privacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (org_id, actor, action, table_name, row_id, old_row, new_row)
  values (
    new.id, (select auth.uid()), 'update', 'orgs', new.id::text,
    jsonb_build_object('privacy_mode', old.privacy_mode),
    jsonb_build_object('privacy_mode', new.privacy_mode)
  );
  return null;
end;
$$;

create trigger audit_privacy after update of privacy_mode on public.orgs
  for each row when (old.privacy_mode is distinct from new.privacy_mode)
  execute function private.audit_org_privacy();
