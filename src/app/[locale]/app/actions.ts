"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseForUser } from "@/lib/supabase/server";

export async function createOrg(locale: string, form: FormData) {
  const name = z.string().trim().min(1).max(200).parse(form.get("name"));
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("create_org", { p_name: name });
  if (error) throw new Error(error.message);
  revalidatePath(`/${locale}/app`);
}

export async function signOut() {
  const supabase = await supabaseForUser();
  await supabase.auth.signOut();
}
