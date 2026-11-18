-- Tesuch initial schema: multi-tenant, RLS on every table, keyed on org_id via memberships.
-- Stores only the employee data the rules need (see docs/ARCHITECTURE.md §Data minimisation).

create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------- Types ----------
create type public.member_role as enum ('owner', 'accountant', 'viewer');
create type public.org_kind as enum ('accounting_firm', 'company');
create type public.contract_type as enum ('indefinite', 'fixed_term');
create type public.termination_initiator as enum ('employer', 'employee', 'mutual');
create type public.leave_type as enum ('annual', 'maternity', 'cash_compensation', 'other');
create type public.rule_status as enum ('verified', 'needs_lawyer_review');
create type public.finding_severity as enum ('red', 'amber', 'advisory', 'info');
create type public.finding_status as enum ('open', 'fixed', 'dismissed');
create type public.alert_channel as enum ('telegram', 'email');

-- ---------- Tenancy ----------
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  kind public.org_kind not null default 'accounting_firm',
  locale text not null default 'hy' check (locale in ('hy', 'ru', 'en')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index on public.memberships (org_id);

-- Security definer so policies can check membership without recursing through memberships RLS.
create function private.has_role(p_org uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

create function private.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role(p_org, array['owner', 'accountant', 'viewer']::public.member_role[]);
$$;

create function private.can_edit(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role(p_org, array['owner', 'accountant']::public.member_role[]);
$$;

-- ---------- Company data ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  tax_id text check (tax_id ~ '^[0-9]{8}$'),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index on public.companies (org_id);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  company_id uuid not null,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  birth_date date,
  six_day_week boolean not null default false,
  external_ref text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  -- Composite FK: an employee can never point at another org's company.
  foreign key (company_id, org_id) references public.companies (id, org_id) on delete cascade
);
create index on public.employees (org_id);
create index on public.employees (company_id);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null,
  type public.contract_type not null,
  start_date date not null,
  end_date date,
  probation_end date,
  probation_special_case boolean not null default false,
  hired_by_transfer boolean not null default false,
  fixed_term_ground text,
  src_registered boolean not null default false,
  terminated_on date,
  termination_ground text,
  termination_initiator public.termination_initiator,
  notice_given_on date,
  workforce_reduction boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  check (end_date is null or end_date >= start_date),
  check (probation_end is null or probation_end >= start_date),
  check (type = 'fixed_term' or end_date is null)
);
create index on public.contracts (org_id);
create index on public.contracts (employee_id);

create table public.leave_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null,
  type public.leave_type not null,
  start_date date not null,
  days integer not null check (days between 0 and 400),
  created_at timestamptz not null default now(),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);
create index on public.leave_records (org_id);
create index on public.leave_records (employee_id);

-- ---------- Rules (global, versioned, read-only to users) ----------
create table public.rules (
  id text not null,
  version integer not null check (version > 0),
  article text,
  status public.rule_status not null,
  definition jsonb not null,
  source_url text not null check (source_url like 'https://www.arlis.am/%'),
  created_at timestamptz not null default now(),
  primary key (id, version),
  check (status <> 'verified' or article is not null)
);

-- ---------- Findings ----------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  company_id uuid not null,
  employee_id uuid not null,
  contract_id uuid references public.contracts (id) on delete cascade,
  rule_id text not null,
  rule_version integer not null,
  severity public.finding_severity not null,
  due_date date not null,
  status public.finding_status not null default 'open',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  foreign key (rule_id, rule_version) references public.rules (id, version),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (company_id, org_id) references public.companies (id, org_id) on delete cascade,
  unique nulls not distinct (rule_id, employee_id, contract_id)
);
create index on public.findings (org_id, status);
create index on public.findings (company_id, status);

-- Users may only change status; everything else is owned by the nightly job.
create function private.findings_user_update_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (
    new.org_id, new.company_id, new.employee_id, new.contract_id, new.rule_id, new.rule_version, new.severity, new.due_date
  ) is distinct from (
    old.org_id, old.company_id, old.employee_id, old.contract_id, old.rule_id, old.rule_version, old.severity, old.due_date
  ) then
    raise exception 'only status can be changed on findings';
  end if;
  if new.status is distinct from old.status then
    new.resolved_at := case when new.status = 'open' then null else now() end;
    new.resolved_by := case when new.status = 'open' then null else (select auth.uid()) end;
  end if;
  return new;
end;
$$;
create trigger findings_user_update_guard before update on public.findings
  for each row execute function private.findings_user_update_guard();

-- ---------- Alerts, templates, audit ----------
create table public.alerts_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  finding_id uuid references public.findings (id) on delete set null,
  channel public.alert_channel not null,
  kind text not null check (kind in ('alert', 'weekly_digest')),
  sent_at timestamptz not null default now(),
  ok boolean not null,
  error text
);
create index on public.alerts_log (org_id, sent_at desc);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs (id) on delete cascade, -- null = built-in template
  kind text not null,
  locale text not null check (locale in ('hy', 'ru', 'en')),
  name text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.templates (org_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor uuid,
  action text not null,
  table_name text not null,
  row_id text,
  at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);
create index on public.audit_log (org_id, at desc);

create function private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (org_id, actor, action, table_name, row_id, old_row, new_row)
  values (
    (r ->> 'org_id')::uuid,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'user_id'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['memberships', 'companies', 'employees', 'contracts', 'leave_records', 'findings', 'templates'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit()', t);
  end loop;
end $$;

-- ---------- Onboarding RPC ----------
-- Creating an org and its first owner membership must be atomic; there is no direct insert policy on orgs.
create function public.create_org(p_name text, p_kind public.org_kind default 'accounting_firm')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  insert into public.orgs (name, kind) values (p_name, p_kind) returning id into v_org;
  insert into public.memberships (user_id, org_id, role) values (v_uid, v_org, 'owner');
  return v_org;
end;
$$;

-- ---------- Row Level Security ----------
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.companies enable row level security;
alter table public.employees enable row level security;
alter table public.contracts enable row level security;
alter table public.leave_records enable row level security;
alter table public.rules enable row level security;
alter table public.findings enable row level security;
alter table public.alerts_log enable row level security;
alter table public.templates enable row level security;
alter table public.audit_log enable row level security;

-- Nothing is reachable without signing in.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
revoke all on schema private from anon, public;
grant usage on schema private to authenticated;
grant execute on function public.create_org(text, public.org_kind) to authenticated;

create policy orgs_select on public.orgs for select to authenticated using (private.is_member(id));
create policy orgs_update on public.orgs for update to authenticated
  using (private.has_role(id, array['owner']::public.member_role[]))
  with check (private.has_role(id, array['owner']::public.member_role[]));

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(org_id));
create policy memberships_owner_write on public.memberships for all to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]))
  with check (private.has_role(org_id, array['owner']::public.member_role[]));

do $$
declare t text;
begin
  foreach t in array array['companies', 'employees', 'contracts', 'leave_records'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (private.is_member(org_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (private.can_edit(org_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (private.can_edit(org_id)) with check (private.can_edit(org_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (private.can_edit(org_id))', t);
  end loop;
end $$;

create policy rules_select on public.rules for select to authenticated using (true);

create policy findings_select on public.findings for select to authenticated using (private.is_member(org_id));
create policy findings_update on public.findings for update to authenticated
  using (private.can_edit(org_id)) with check (private.can_edit(org_id));

create policy alerts_select on public.alerts_log for select to authenticated using (private.is_member(org_id));

create policy templates_select on public.templates for select to authenticated
  using (org_id is null or private.is_member(org_id));
create policy templates_write on public.templates for all to authenticated
  using (org_id is not null and private.can_edit(org_id))
  with check (org_id is not null and private.can_edit(org_id));

create policy audit_select on public.audit_log for select to authenticated
  using (org_id is not null and private.has_role(org_id, array['owner']::public.member_role[]));
