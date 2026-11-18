import { hasSupabase } from "./helpers/env";
import { deleteAllTestUsers } from "./helpers/supabase";

/** Deletes every qa-e-* user and the orgs they own (cascades to all tenant data). */
export default async function globalTeardown() {
  if (!hasSupabase()) return;
  await deleteAllTestUsers();
}
