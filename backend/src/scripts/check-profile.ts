import { supabaseAdmin } from "../lib/supabase";

const EMAIL = (process.env.SEED_EMAIL ?? "admin@rpmcares.local").trim().toLowerCase();

async function check() {
  // 1. Find the auth user
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const authUser = usersData?.users.find((u) => u.email?.toLowerCase() === EMAIL);

  if (!authUser) {
    console.log(`❌ No Supabase auth user found for "${EMAIL}"`);
    return;
  }
  console.log(`✅ Auth user found: id=${authUser.id} email=${authUser.email}`);

  // 2. Check profiles table
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    console.log(`❌ Error querying profiles table: ${error.message}`);
    console.log("   → The 'profiles' table may not exist. Run the migration in Supabase SQL Editor.");
    console.log("   → Migration file: backend/src/db/migrations/0001_init.sql");
    return;
  }

  if (!profile) {
    console.log(`❌ No profile row found for id=${authUser.id}`);
    console.log("   → Inserting profile now...");
    const { error: insertError } = await supabaseAdmin.from("profiles").insert({
      id: authUser.id,
      email: EMAIL,
      role: "super_admin",
      name: "Super Admin",
      clinic_id: null,
      invited_by: null,
    });
    if (insertError) {
      console.log(`❌ Insert failed: ${insertError.message}`);
    } else {
      console.log(`✅ Profile created successfully. You can now log in.`);
    }
    return;
  }

  console.log(`✅ Profile found: role=${profile.role} name=${profile.name}`);
  console.log("   → Login should work. Try again in the app.");
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});
