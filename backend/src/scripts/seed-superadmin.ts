import { supabaseAdmin } from "../lib/supabase";

const EMAIL = (process.env.SEED_EMAIL ?? "admin@rpmcares.local").trim().toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD ?? "admin";
const NAME = "Super Admin";

async function seed() {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existing?.users.find((u) => u.email?.toLowerCase() === EMAIL);

  let userId: string;

  if (existingUser) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password: PASSWORD,
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, email: EMAIL, role: "super_admin", name: NAME, clinic_id: null, invited_by: null },
      { onConflict: "id" },
    );
  if (profileError) throw profileError;

  console.log(`Seeded super admin "${EMAIL}" (temporary password: "${PASSWORD}"). Change this before production.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
