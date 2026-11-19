-- Legal & Compliance: append-only record of which version of the Terms, Privacy notice and DPA each
-- user accepted. DRAFT texts pending a licensed Armenian lawyer (docs/legal/LAWYER_CHECKLIST.md).
--
-- Rules:
-- * A user reads and inserts only their own rows. Nobody (including the user) updates or deletes a
--   record through the API: it is evidence. Rows go away only with the user account (cascade), which
--   is how an erasure request is honoured. Whether records must outlive the account is a lawyer question.
-- * accepted_at is always the server time: users have no insert grant on it (nor on id).
-- * ip_hash is optional and must be a hex SHA-256/HMAC digest, never a raw IP.

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'dpa')),
  version text not null check (version ~ '^[0-9A-Za-z._-]{1,32}$'),
  accepted_at timestamptz not null default now(),
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
  unique (user_id, document, version)
);
comment on table public.consent_records is 'Append-only: which document version each user accepted. No update/delete policies by design.';

alter table public.consent_records enable row level security;
revoke all on public.consent_records from anon, authenticated, public;
grant select on public.consent_records to authenticated;
grant insert (user_id, document, version, ip_hash) on public.consent_records to authenticated;

create policy consent_records_own_select on public.consent_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy consent_records_own_insert on public.consent_records for insert to authenticated
  with check (user_id = (select auth.uid()));
-- No update or delete policy (and no grant): records are immutable for API users.
