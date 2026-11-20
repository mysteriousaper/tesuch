-- F1 firm deadline inbox: findings can be assigned to a colleague.
-- assignee_id must be an owner or accountant of the finding's own org (checked in a trigger, not only in the app).
-- Users with edit rights may change `status` and `assignee_id` and nothing else; the nightly job (no auth.uid()) is unrestricted.

alter table public.findings add column assignee_id uuid references auth.users (id) on delete set null;
create index on public.findings (org_id, assignee_id) where status = 'open';

-- Security definer: reads memberships without going through the caller's RLS.
create function private.assignee_ok(p_org uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = p_user and m.role in ('owner', 'accountant')
  );
$$;

create function private.findings_assignee_check()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not private.assignee_ok(new.org_id, new.assignee_id) then
    raise exception 'assignee_not_member' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger findings_assignee_check before insert or update on public.findings
  for each row execute function private.findings_assignee_check();

-- Users may change status and assignee_id; everything else is owned by the nightly job.
create or replace function private.findings_user_update_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (
    new.id, new.org_id, new.company_id, new.employee_id, new.contract_id, new.rule_id, new.rule_version, new.severity, new.due_date,
    new.first_seen_at, new.last_seen_at
  ) is distinct from (
    old.id, old.org_id, old.company_id, old.employee_id, old.contract_id, old.rule_id, old.rule_version, old.severity, old.due_date,
    old.first_seen_at, old.last_seen_at
  ) then
    raise exception 'only status and assignee can be changed on findings';
  end if;
  if (select auth.uid()) is not null and new.status is not distinct from old.status
     and (new.resolved_at, new.resolved_by) is distinct from (old.resolved_at, old.resolved_by) then
    raise exception 'only status and assignee can be changed on findings';
  end if;
  if new.status is distinct from old.status then
    new.resolved_at := case when new.status = 'open' then null else now() end;
    new.resolved_by := case when new.status = 'open' then null else (select auth.uid()) end;
  end if;
  return new;
end;
$$;
