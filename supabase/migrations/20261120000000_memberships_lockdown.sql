-- Security (C-1): memberships can no longer be written directly by clients.
-- The old `memberships_owner_write ... for all` policy let an org owner INSERT a membership for ANY user id
-- (with any role and a backdated created_at), forcing that user into the owner's org; the victim's app then
-- opened that org first and their data entry landed where the attacker could read it.
--
-- After this migration:
--   * INSERT: only through SECURITY DEFINER RPCs (public.create_org for the first owner,
--     public.accept_invitation for invited users). No client grant, no policy.
--   * UPDATE: only the `role` column, only by an owner of the row's org. user_id, org_id and created_at
--     are not updatable at all. private.keep_one_owner() still blocks leaving an org without an owner.
--   * DELETE: an owner of the row's org may remove any member; any member may remove themselves (leave).
--     The last-owner guard still applies.

drop policy if exists memberships_owner_write on public.memberships;

revoke insert, update, truncate, references, trigger on public.memberships from anon, authenticated;
revoke all on public.memberships from anon;
grant update (role) on public.memberships to authenticated;

create policy memberships_owner_update on public.memberships for update to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]))
  with check (private.has_role(org_id, array['owner']::public.member_role[]));

create policy memberships_delete on public.memberships for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_role(org_id, array['owner']::public.member_role[]));
