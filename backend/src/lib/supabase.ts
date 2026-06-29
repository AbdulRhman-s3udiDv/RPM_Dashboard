import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

// service_role bypasses RLS — never used for user sign-in (that would
// overwrite its in-memory session and break subsequent DB queries).
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Anon-key client — used only for signInWithPassword so supabaseAdmin stays clean.
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
