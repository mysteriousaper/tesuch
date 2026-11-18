-- Leads from the public self-check. Nobody reads them through the API: only the service role
-- (and the Supabase dashboard) can. Insert goes exclusively through submit_lead(), which validates and throttles.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 254),
  locale text not null check (locale in ('hy', 'ru', 'en')),
  score integer check (score between 0 and 100),
  answers jsonb not null default '{}'::jsonb check (pg_column_size(answers) <= 4096),
  company_size text check (length(company_size) <= 40),
  role text check (length(role) <= 40),
  consent boolean not null check (consent),
  created_at timestamptz not null default now()
);
create index on public.leads (lower(email), created_at desc);

alter table public.leads enable row level security;
-- No policies at all: anon/authenticated can neither read nor write the table directly.
revoke all on public.leads from anon, authenticated;

create function public.submit_lead(
  p_email text,
  p_locale text,
  p_score integer,
  p_answers jsonb,
  p_company_size text,
  p_role text,
  p_consent boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_consent is distinct from true then
    raise exception 'consent required' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if p_locale is null or p_locale not in ('hy', 'ru', 'en') then
    raise exception 'invalid locale' using errcode = '22023';
  end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid answers' using errcode = '22023';
  end if;
  if exists (select 1 from public.leads where lower(email) = v_email and created_at > now() - interval '10 minutes') then
    raise exception 'too many submissions' using errcode = 'P0429';
  end if;

  insert into public.leads (email, locale, score, answers, company_size, role, consent)
  values (
    v_email,
    p_locale,
    case when p_score between 0 and 100 then p_score end,
    coalesce(p_answers, '{}'::jsonb),
    nullif(left(trim(coalesce(p_company_size, '')), 40), ''),
    nullif(left(trim(coalesce(p_role, '')), 40), ''),
    true
  );
end;
$$;

revoke all on function public.submit_lead(text, text, integer, jsonb, text, text, boolean) from public;
grant execute on function public.submit_lead(text, text, integer, jsonb, text, text, boolean) to anon, authenticated;
