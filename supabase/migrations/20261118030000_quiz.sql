-- Weekly "surprise inspection" quiz attempts.
-- Scores are computed on the server (src/app/[locale]/app/quiz/actions.ts) and written with the service role.
-- Users can read their org's attempts but cannot write them directly, so a forged score is impossible.

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  company_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  iso_week text not null check (iso_week ~ '^[0-9]{4}-W[0-9]{2}$'),
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  score integer not null check (score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (company_id, iso_week, user_id),
  -- Composite FK: an attempt can never point at another org's company.
  foreign key (company_id, org_id) references public.companies (id, org_id) on delete cascade
);
create index on public.quiz_attempts (org_id);
create index on public.quiz_attempts (company_id, iso_week);

alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_attempts from anon;
-- No insert/update/delete for users: only the server action (service role) writes, after checking the
-- caller is an owner/accountant of the org and recomputing the score.
revoke insert, update, delete on public.quiz_attempts from authenticated;

create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (private.is_member(org_id));

create trigger audit after insert or update or delete on public.quiz_attempts
  for each row execute function private.audit();
