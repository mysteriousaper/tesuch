import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
console.log("breaker users left:", data.users.filter(u => u.email?.startsWith("qa-e-breaker-")).length);
const { data: o } = await db.from("orgs").select("id,name").ilike("name", "%Breaker%");
console.log("breaker orgs left:", o?.length);
