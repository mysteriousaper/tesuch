-- M-3: per-visitor throttle for the public lead form.
-- The server action passes an HMAC of the caller's IP (never the IP itself). submit_lead allows at most
-- 5 leads per IP hash per rolling hour, and the global cap rises from 30 to 100 per hour so a few
-- noisy visitors cannot lock everyone else out. Only the service role may execute it (unchanged).

alter table public.leads add column if not exists ip_hash text check (ip_hash is null or length(ip_hash) <= 64);
create index if not exists leads_ip_hash_idx on public.leads (ip_hash, created_at desc) where ip_hash is not null;

drop function if exists public.submit_lead(text, text, integer, jsonb, text, text, boolean);

create function public.submit_lead(
  p_email text,
  p_locale text,
  p_score integer,
  p_answers jsonb,
  p_company_size text,
  p_role text,
  p_consent boolean,
  p_ip_hash text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip text := nullif(left(trim(coalesce(p_ip_hash, '')), 64), '');
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
  if (select count(*) from public.leads where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'too many submissions overall' using errcode = 'P0429';
  end if;
  if v_ip is not null and (select count(*) from public.leads where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many submissions from this visitor' using errcode = 'P0429';
  end if;
  if exists (select 1 from public.leads where lower(email) = v_email and created_at > now() - interval '10 minutes') then
    raise exception 'too many submissions' using errcode = 'P0429';
  end if;

  insert into public.leads (email, locale, score, answers, company_size, role, consent, ip_hash)
  values (
    v_email,
    p_locale,
    case when p_score between 0 and 100 then p_score end,
    coalesce(p_answers, '{}'::jsonb),
    nullif(left(trim(coalesce(p_company_size, '')), 40), ''),
    nullif(left(trim(coalesce(p_role, '')), 40), ''),
    true,
    v_ip
  );
end;
$$;

revoke all on function public.submit_lead(text, text, integer, jsonb, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_lead(text, text, integer, jsonb, text, text, boolean, text) to service_role;
