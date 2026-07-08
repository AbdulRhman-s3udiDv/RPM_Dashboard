import { supabaseAdmin } from "../lib/supabase";

export type Role = "super_admin" | "clinic_admin" | "staff";

export type ProfileRecord = {
  id: string;
  email: string;
  role: Role;
  name: string;
  clinic_id: string | null;
  invited_by: string | null;
  created_at: string;
};

const SELECT_COLUMNS = "id, email, role, name, clinic_id, invited_by, created_at";

export async function findProfileById(id: string): Promise<ProfileRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRecord | null;
}

export async function listProfiles(filter: { roles?: Role[]; clinicId?: string }): Promise<ProfileRecord[]> {
  let query = supabaseAdmin.from("profiles").select(SELECT_COLUMNS).order("created_at", { ascending: false });
  if (filter.roles?.length) query = query.in("role", filter.roles);
  if (filter.clinicId) query = query.eq("clinic_id", filter.clinicId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as ProfileRecord[]) ?? [];
}

export async function createProfile(profile: {
  id: string;
  email: string;
  role: Role;
  name: string;
  clinicId: string | null;
  invitedBy: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("profiles").insert({
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: profile.name,
    clinic_id: profile.clinicId,
    invited_by: profile.invitedBy,
  });
  if (error) throw error;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<ProfileRecord, "name" | "role" | "clinic_id">>,
): Promise<ProfileRecord> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data as ProfileRecord;
}
