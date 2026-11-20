-- S-1 "codes by default".
-- * orgs.privacy_mode now defaults to true for NEW orgs. Existing rows keep their value (a column default never rewrites rows),
--   so no existing firm is flipped silently.
-- * orgs.codes_notice_dismissed: existing firms that still store names see a one-time owner notice suggesting codes.
--   Firms created from now on are already on codes, so they start with the notice dismissed.
-- * employees insert trigger: where names are hidden (org privacy_mode on) every employee gets a code. A missing code is
--   generated (EMP-001, EMP-002, ... per company) and full_name is forced to the code, so no name is ever stored by accident.
alter table public.orgs alter column privacy_mode set default true;

alter table public.orgs add column codes_notice_dismissed boolean not null default false;
alter table public.orgs alter column codes_notice_dismissed set default true;

-- Per-company counter in the private schema (not exposed through the API, no audit noise). A counter, not max()+1,
-- because rows of one bulk INSERT cannot see each other inside a BEFORE ROW trigger.
create table private.company_code_counters (
  company_id uuid primary key references public.companies (id) on delete cascade,
  last_number integer not null default 0
);
-- No policy and no grant: only the security definer trigger below touches it.
alter table private.company_code_counters enable row level security;

create function private.employee_code_default()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_privacy boolean;
  v_number integer;
begin
  select o.privacy_mode into v_privacy from public.orgs o where o.id = new.org_id;
  if not coalesce(v_privacy, false) then
    return new;
  end if;
  if new.employee_code is null or length(trim(new.employee_code)) = 0 then
    loop
      insert into private.company_code_counters (company_id, last_number)
        values (new.company_id, 1)
        on conflict (company_id) do update set last_number = private.company_code_counters.last_number + 1
        returning last_number into v_number;
      -- lpad truncates, so pad only below 100 (EMP-001 ... EMP-099, then EMP-100, EMP-1000, ...)
      new.employee_code := 'EMP-' || case when v_number < 100 then lpad(v_number::text, 3, '0') else v_number::text end;
      -- skip numbers already taken by codes typed or imported by hand
      exit when not exists (
        select 1 from public.employees e where e.company_id = new.company_id and lower(e.employee_code) = lower(new.employee_code)
      );
    end loop;
  end if;
  new.full_name := new.employee_code;
  return new;
end;
$$;

create trigger employees_code_default before insert on public.employees
  for each row execute function private.employee_code_default();

