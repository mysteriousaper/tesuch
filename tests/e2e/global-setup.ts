import { hasSupabase } from "./helpers/env";
import { deleteAllTestUsers } from "./helpers/supabase";

/** Clears leftovers from interrupted runs so every run starts clean. */
export default async function globalSetup() {
  if (!hasSupabase()) return;
  await deleteAllTestUsers();
}
