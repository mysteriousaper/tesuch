-- The findings assignee trigger (20261121100000) calls private.assignee_ok(). Triggers run as the calling role,
-- and the nightly job / on-demand rule runs write findings as service_role, which had no USAGE on schema private
-- ("permission denied for schema private"). service_role is server-only and already bypasses RLS, so granting it
-- the private helpers adds no new exposure. anon/authenticated are unchanged.
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
