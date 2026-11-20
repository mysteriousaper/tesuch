-- M-14: dismissing a finding needs a written reason (audit trail for "why was this ignored?").
-- * findings.dismissed_reason: set together with status = 'dismissed', cleared when the finding is reopened or fixed.
-- * Users (auth.uid() not null) cannot dismiss without a reason of at least 3 characters. The nightly job (service role, no uid)
--   never dismisses, so it is unaffected.
-- * The guard still lets users change nothing but status, assignee and the reason.
alter table public.findings
  add column dismissed_reason text check (dismissed_reason is null or length(trim(dismissed_reason)) between 3 and 500);

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
  if new.status = 'dismissed' then
    if (select auth.uid()) is not null and new.status is distinct from old.status
       and (new.dismissed_reason is null or length(trim(new.dismissed_reason)) < 3) then
      raise exception 'dismissing a finding needs a reason' using errcode = '23514';
    end if;
  else
    new.dismissed_reason := null;
  end if;
  return new;
end;
$$;
