import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { evaluatePatientBilling } from "../services/billing-engine";

export async function listCommunications(req: Request, res: Response): Promise<void> {
  const profile = req.profile!;
  const { patientId, limit = "100" } = req.query as Record<string, string>;

  let q = supabaseAdmin
    .from("communications_log")
    .select("*, profiles!communications_log_staff_id_fkey(name)")
    .order("occurred_at", { ascending: false })
    .limit(parseInt(limit));

  if (patientId) q = q.eq("patient_id", patientId);
  else if (profile.role === "clinic_admin" && profile.clinic_id) q = q.eq("clinic_id", profile.clinic_id);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const logs = (data ?? []).map((row: any) => ({
    ...row,
    staff_name: row.profiles?.name ?? null,
    profiles: undefined,
  }));

  res.json({ logs });
}

export async function createCommunication(req: Request, res: Response): Promise<void> {
  const profile = req.profile!;
  const {
    patient_id, clinic_id, comm_type, direction,
    duration_seconds, summary, transcript, occurred_at, program,
  } = req.body;

  if (!patient_id) {
    res.status(400).json({ error: "patient_id is required." });
    return;
  }

  const resolvedClinicId = clinic_id ?? profile.clinic_id;
  const occurredAt       = occurred_at ?? new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("communications_log")
    .insert({
      patient_id,
      clinic_id:       resolvedClinicId,
      staff_id:        profile.id,
      comm_type:       comm_type   ?? "call",
      direction:       direction   ?? "outbound",
      duration_seconds: duration_seconds ?? null,
      summary:         summary     ?? null,
      transcript:      transcript  ?? null,
      occurred_at:     occurredAt,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Auto-log call duration as a time log entry so it counts toward CPT thresholds
  if (duration_seconds && duration_seconds > 0) {
    await supabaseAdmin.from("time_logs").insert({
      patient_id,
      clinic_id:       resolvedClinicId,
      staff_id:        profile.id,
      program:         program ?? "RPM",
      activity_type:   "call",
      duration_seconds,
      notes:           `${comm_type ?? "call"} — ${new Date(occurredAt).toLocaleDateString()}`,
      logged_at:       occurredAt,
    });

    evaluatePatientBilling(patient_id).catch(console.warn);
  }

  res.status(201).json({ log: data });
}
