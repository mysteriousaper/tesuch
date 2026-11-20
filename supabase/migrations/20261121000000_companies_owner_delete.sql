-- M-10: only owners may change or remove a company. Accountants keep insert/select (and edit all data below the company).
drop policy companies_update on public.companies;
drop policy companies_delete on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]))
  with check (private.has_role(org_id, array['owner']::public.member_role[]));
create policy companies_delete on public.companies for delete to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]));
