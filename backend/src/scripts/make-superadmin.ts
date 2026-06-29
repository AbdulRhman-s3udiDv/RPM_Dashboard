import { supabaseAdmin } from "../lib/supabase";

// Usage: ADMIN_EMAIL=you@example.com npx tsx src/scripts/make-superadmin.ts
const EMAIL = (process.env.ADMIN_EMAIL ?? process.env.SEED_EMAIL ?? "").trim().toLowerCase();
if (!EMAIL) {
  console.error("Set ADMIN_EMAIL env var to the email you want to promote.");
  process.exit(1);
}

async function run() {
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const authUser = usersData?.users.find((u) => u.email?.toLowerCase() === EMAIL);

  if (!authUser) {
    console.log(`❌ No Supabase auth user found for "${EMAIL}". Create the account in Supabase Auth first.`);
    process.exit(1);
  }

  console.log(`Found auth user: id=${authUser.id}`);

  const { error } = await supabaseAdmin.from("profiles").upsert(
    { id: authUser.id, email: EMAIL, role: "super_admin", name: "Super Admin", clinic_id: null, invited_by: null },
    { onConflict: "id" },
  );

  if (error) {
    console.error(`❌ Failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`✅ Profile upserted for "${EMAIL}" as super_admin. You can now log in.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
