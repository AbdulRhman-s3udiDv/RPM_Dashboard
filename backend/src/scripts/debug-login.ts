import { supabaseAdmin } from "../lib/supabase";

const EMAIL = "admin@rpmcares.local";
const PASSWORD = "Admin123";

async function run() {
  console.log("1. Signing in with password...");
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

  if (error) {
    console.log(`❌ signInWithPassword error: ${error.message}`);
    return;
  }

  console.log(`✅ Signed in. user.id = ${data.user?.id}`);
  console.log(`   session access_token present: ${!!data.session?.access_token}`);

  console.log("\n2. Looking up profile...");
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .eq("id", data.user?.id)
    .maybeSingle();

  if (profileError) {
    console.log(`❌ Profile query error: ${profileError.message}`);
    return;
  }

  if (!profile) {
    console.log(`❌ No profile found for id=${data.user?.id}`);
    console.log("\n3. All profiles in table:");
    const { data: all } = await supabaseAdmin.from("profiles").select("id, email, role");
    console.log(all);
  } else {
    console.log(`✅ Profile found: ${JSON.stringify(profile)}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
