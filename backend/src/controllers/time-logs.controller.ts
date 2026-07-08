import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { evaluatePatientBilling } from "../services/billing-engine";

export async function listTimeLogs(req: Request, res: Response): Promise<void> {
  const profile = req.profile!;
  const { patientId, clinicId, from, to, limit = "100" } = req.query as Record<string, string>;

  let q = supabaseAdmin
    .from("time_logs")
    .select("*, profiles!time_logs_staff_id_fkey(name, email)")
    .order("logged_at", { ascending: false })
    .limit(parseInt(limit));

  if (patientId) {
    q = q.eq("patient_id", patientId);
  } else if (clinicId) {
    q = q.eq("clinic_id", clinicId);
  } else if (profile.role === "clinic_admin" && profile.clinic_id) {
    q = q.eq("clinic_id", profile.clinic_id);
  }

  if (from) q = q.gte("logged_at", from);
  if (to)   q = q.lte("logged_at", to);

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const logs = (data ?? []).map((row: any) => ({
    ...row,
    staff_name:      row.profiles?.name  ?? null,
    staff_email:     row.profiles?.email ?? null,
    duration_minutes: Math.round(row.duration_seconds / 60),
    profiles: undefined,
  }));

  res.json({ logs });
}

export async function createTimeLog(req: Request, res: Response): Promise<void> {
  const profile = req.profile!;
  const { patient_id, clinic_id, program, activity_type, duration_seconds, notes, logged_at } = req.body;

  if (!patient_id || !program || !duration_seconds) {
    res.status(400).json({ error: "patient_id, program, and duration_seconds are required." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("time_logs")
    .insert({
      patient_id,
      clinic_id:       clinic_id ?? profile.clinic_id,
      staff_id:        profile.id,
      program,
      activity_type:   activity_type ?? "review",
      duration_seconds,
      notes:           notes ?? null,
      logged_at:       logged_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Non-blocking re-evaluation — new time may unlock a CPT threshold
  evaluatePatientBilling(patient_id).catch(console.warn);

  res.status(201).json({ log: { ...data, duration_minutes: Math.round(data.duration_seconds / 60) } });
}

export async function updateTimeLog(req: Request, res: Response): Promise<void> {
  const { id }    = req.params;
  const profile   = req.profile!;
  const { duration_seconds, notes, activity_type, logged_at } = req.body;

  const { data: existing } = await supabaseAdmin
    .from("time_logs")
    .select("staff_id, patient_id")
    .eq("id", id)
    .single();

  if (!existing) { res.status(404).json({ error: "Time log not found." }); return; }
  if (profile.role !== "super_admin" && existing.staff_id !== profile.id) {
    res.status(403).json({ error: "You can only edit your own time logs." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("time_logs")
    .update({ duration_seconds, notes, activity_type, logged_at, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  evaluatePatientBilling(existing.patient_id).catch(console.warn);

  res.json({ log: { ...data, duration_minutes: Math.round(data.duration_seconds / 60) } });
}

export async function deleteTimeLog(req: Request, res: Response): Promise<void> {
  const { id }  = req.params;
  const profile = req.profile!;

  const { data: existing } = await supabaseAdmin
    .from("time_logs")
    .select("staff_id, patient_id")
    .eq("id", id)
    .single();

  if (!existing) { res.status(404).json({ error: "Time log not found." }); return; }
  if (profile.role !== "super_admin" && existing.staff_id !== profile.id) {
    res.status(403).json({ error: "You can only delete your own time logs." });
    return;
  }

  const { error } = await supabaseAdmin.from("time_logs").delete().eq("id", id);
  if (error) { res.status(500).json({ error: error.message }); return; }

  evaluatePatientBilling(existing.patient_id).catch(console.warn);

  res.json({ ok: true });
}
