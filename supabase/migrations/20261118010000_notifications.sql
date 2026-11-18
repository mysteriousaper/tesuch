-- Telegram account linking and per-user notification settings.

create table public.telegram_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id bigint not null unique,
  linked_at timestamptz not null default now()
);

-- One-time deep-link tokens: t.me/<bot>?start=<token>. Consumed by the webhook (service role).
create table public.telegram_link_tokens (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 minutes'
);
create index on public.telegram_link_tokens (user_id);

alter table public.telegram_links enable row level security;
alter table public.telegram_link_tokens enable row level security;
revoke all on public.telegram_links, public.telegram_link_tokens from anon;

create policy telegram_links_own_select on public.telegram_links for select to authenticated
  using (user_id = (select auth.uid()));
create policy telegram_links_own_delete on public.telegram_links for delete to authenticated
  using (user_id = (select auth.uid()));
-- No user policies on telegram_link_tokens: only the RPC below and the service role touch it.

create function public.create_telegram_link_token()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  delete from public.telegram_link_tokens where user_id = v_uid or expires_at < now();
  -- Two v4 UUIDs = 244 random bits; avoids depending on pgcrypto's schema.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.telegram_link_tokens (token, user_id) values (v_token, v_uid);
  return v_token;
end;
$$;
revoke all on function public.create_telegram_link_token() from anon, public;
grant execute on function public.create_telegram_link_token() to authenticated;
