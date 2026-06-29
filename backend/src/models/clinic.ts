import { supabaseAdmin } from "../lib/supabase";

export type ClinicRecord = {
  id: string;
  name: string;
  specialty: string | null;
  location: string | null;
  created_at: string;
  hasSmartMeterKey: boolean;
};

const SELECT = "id, name, specialty, location, created_at, smartmeter_api_key";

export async function listClinics(): Promise<ClinicRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select(SELECT)
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

function mapRow(r: any): ClinicRecord {
  return {
    id: r.id, name: r.name, specialty: r.specialty, location: r.location,
    created_at: r.created_at, hasSmartMeterKey: !!r.smartmeter_api_key,
  };
}

export async function findClinicById(id: string): Promise<ClinicRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function createClinic(name: string): Promise<ClinicRecord> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .insert({ name })
    .select(SELECT)
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteClinic(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("clinics").delete().eq("id", id);
  if (error) throw error;
}

export type ClinicPatch = {
  smartmeter_api_key?: string;
  specialty?: string;
  location?: string;
};

export async function updateClinic(id: string, patch: ClinicPatch): Promise<ClinicRecord> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return mapRow(data);
}
