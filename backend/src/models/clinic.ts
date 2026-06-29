import { supabaseAdmin } from "../lib/supabase";

export type ClinicRecord = {
  id: string;
  name: string;
  specialty: string | null;
  location: string | null;
  created_at: string;
};

const SELECT = "id, name, specialty, location, created_at";

export async function listClinics(): Promise<ClinicRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select(SELECT)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as ClinicRecord[]) ?? [];
}

export async function findClinicById(id: string): Promise<ClinicRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ClinicRecord | null;
}

export async function createClinic(name: string): Promise<ClinicRecord> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .insert({ name })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as ClinicRecord;
}

export async function deleteClinic(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("clinics").delete().eq("id", id);
  if (error) throw error;
}
