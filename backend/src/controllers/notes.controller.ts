import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

export async function listNotes(req: Request, res: Response): Promise<void> {
  const profile = req.profile!;
  const { patientId, status, limit = "50" } = req.query as Record<string, string>;

  let q = supabaseAdmin
    .from("care_notes")
    .select("*, profiles!care_notes_author_id_fkey(name)")
    .order("dos",        { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(parseInt(limit));

  if (patientId) q = q.eq("patient_id", patientId);
  if (status)    q = q.eq("status", status);
  if (profile.role === "clinic_admin" && profile.clinic_id && !patientId) {
    q = q.eq("clinic_id", profile.clinic_id);
  }

  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const notes = (data ?? []).map((row: any) => ({
    ...row,
    author_name: row.profiles?.name ?? null,
    profiles: undefined,
  }));

  res.json({ notes });
}

export async function createNote(req: Request, res: Response): Promise<void> {
  const profile = req.profile!;
  const { patient_id, clinic_id, note_type, cpt_codes, content, dos, cycle_start } = req.body;

  if (!patient_id || !content) {
    res.status(400).json({ error: "patient_id and content are required." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("care_notes")
    .insert({
      patient_id,
      clinic_id:   clinic_id ?? profile.clinic_id,
      author_id:   profile.id,
      note_type:   note_type   ?? "manual",
      cpt_codes:   cpt_codes   ?? [],
      content,
      dos:         dos          ?? null,
      cycle_start: cycle_start  ?? null,
      status:      "draft",
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("note_audit_log").insert({
    note_id:    data.id,
    changed_by: profile.id,
    change_type: "created",
  });

  res.status(201).json({ note: data });
}

export async function updateNote(req: Request, res: Response): Promise<void> {
  const { id }    = req.params;
  const profile   = req.profile!;
  const { content, status, cpt_codes, dos } = req.body;

  const { data: existing } = await supabaseAdmin
    .from("care_notes")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) { res.status(404).json({ error: "Note not found." }); return; }
  if (existing.status === "locked") {
    res.status(409).json({ error: "This note is locked and cannot be edited." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("care_notes")
    .update({ content, status, cpt_codes, dos, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("note_audit_log").insert({
    note_id:          id,
    changed_by:       profile.id,
    change_type:      "edited",
    previous_content: existing.content,
  });

  res.json({ note: data });
}

export async function signNote(req: Request, res: Response): Promise<void> {
  const { id }  = req.params;
  const profile = req.profile!;
  const now     = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("care_notes")
    .update({ status: "signed", signed_by: profile.id, signed_at: now, updated_at: now })
    .eq("id", id)
    .neq("status", "locked")
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("note_audit_log").insert({
    note_id: id, changed_by: profile.id, change_type: "signed",
  });

  res.json({ note: data });
}

export async function lockNote(req: Request, res: Response): Promise<void> {
  const { id }  = req.params;
  const profile = req.profile!;

  if (profile.role !== "super_admin") {
    res.status(403).json({ error: "Only super admins can lock notes." });
    return;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("care_notes")
    .update({ status: "locked", updated_at: now })
    .eq("id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  await supabaseAdmin.from("note_audit_log").insert({
    note_id: id, changed_by: profile.id, change_type: "locked",
  });

  res.json({ note: data });
}
