-- "Documents to have ready" (labour inspection checklist N 5.1): owner/accountant tick "we have it" per company and question.
-- The question list itself lives in rules/checklist/N5.1.json; only the ticks are stored.
create table public.checklist_ticks (
  org_id uuid not null,
  company_id uuid not null,
  question_no text not null check (question_no ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$'),
  ticked_by uuid default auth.uid() references auth.users (id) on delete set null,
  ticked_at timestamptz not null default now(),
  primary key (company_id, question_no),
  -- Composite FK: a tick can never point at another org's company.
  foreign key (company_id, org_id) references public.companies (id, org_id) on delete cascade
);
create index on public.checklist_ticks (org_id);

alter table public.checklist_ticks enable row level security;
revoke all on public.checklist_ticks from anon;
create policy checklist_ticks_select on public.checklist_ticks for select to authenticated using (private.is_member(org_id));
create policy checklist_ticks_insert on public.checklist_ticks for insert to authenticated with check (private.can_edit(org_id));
create policy checklist_ticks_delete on public.checklist_ticks for delete to authenticated using (private.can_edit(org_id));
-- No update policy: a tick is added or removed, never edited.
