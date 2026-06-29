import { supabaseAdmin } from "../lib/supabase";

export type AlertStatus = "open" | "assigned" | "escalated" | "resolved";

export type AlertEvent = {
  id: string;
  timestamp: string | null;
  patient_id: string;
  patient_name: string;
  clinic_name: string;
  alert_type: string;
  tier: string;
  value: string | null;
  unit: string | null;
  threshold: string | null;
  device_type: string | null;
  reading_id: string | null;
  reading_time: string | null;
  provider_email: string | null;
  sms_sent: string | null;
  email_sent: string | null;
  status: AlertStatus;
  assigned_to: string | null;
  assignee: { id: string; name: string; email: string } | null;
  resolved_at: string | null;
  created_at: string;
};

export async function listAlerts(filters: { clinicName?: string; status?: string } = {}) {
  let q = supabaseAdmin
    .from("alert_events")
    .select("*, assignee:assigned_to(id, name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.clinicName) q = q.eq("clinic_name", filters.clinicName);
  if (filters.status) q = q.eq("status", filters.status);

  const { data, error } = await q;
  return { data, error };
}

export async function patchAlert(
  id: string,
  patch: { status?: AlertStatus; assigned_to?: string | null; resolved_at?: string | null },
) {
  const { data, error } = await supabaseAdmin
    .from("alert_events")
    .update(patch)
    .eq("id", id)
    .select("*, assignee:assigned_to(id, name, email)")
    .single();
  return { data, error };
}
