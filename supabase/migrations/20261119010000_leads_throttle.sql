-- S-1: stop lead flooding.
-- 1. submit_lead is no longer callable with the public anon key: only the service role (the Next.js
--    server action) may execute it, so nobody can loop the RPC directly against Supabase.
-- 2. A global cap (30 leads per rolling hour) protects the server action too, on top of the
--    existing per-email 10-minute throttle. Both raise P0429, which the app shows as "try later".

create or replace function public.submit_lead(
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

  -- Serialise submissions so concurrent calls can't both slip under the caps.
  perform pg_advisory_xact_lock(hashtext('public.submit_lead'));
  if (select count(*) from public.leads where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many submissions overall' using errcode = 'P0429';
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

revoke all on function public.submit_lead(text, text, integer, jsonb, text, text, boolean) from public, anon, authenticated;
grant execute on function public.submit_lead(text, text, integer, jsonb, text, text, boolean) to service_role;

-- The hourly cap counts recent rows; keep that cheap.
create index if not exists leads_created_at_idx on public.leads (created_at desc);
