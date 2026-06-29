import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" },
});

async function run() {
  console.log("SUPABASE_URL:", URL);

  // 1. Check if table exists via information_schema
  const { data: tableCheck, error: tableErr } = await db
    .from("information_schema.tables" as never)
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", "profiles");

  console.log("Table check:", tableCheck, tableErr?.message);

  // 2. Get the auth user
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = users?.users.find((u) => u.email === "admin@rpmcares.local");
  if (!user) { console.log("❌ No auth user found"); return; }
  console.log("Auth user id:", user.id);

  // 3. Try a direct insert (not upsert) and log the full response
  const insertRes = await db.from("profiles").insert({
    id: user.id,
    email: "admin@rpmcares.local",
    role: "super_admin",
    name: "Super Admin",
    clinic_id: null,
    invited_by: null,
  }).select();

  console.log("Insert result:", JSON.stringify(insertRes, null, 2));

  // 4. Read back
  const { data: all, error: readErr } = await db.from("profiles").select("*");
  console.log("All profiles after insert:", all, readErr?.message);
}

run().catch(console.error);
