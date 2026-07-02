import type { Request, Response } from "express";
import { findClinicById } from "../models/clinic";
import { listAlerts, patchAlert, type AlertStatus } from "../models/alert-event";
import { findProfileById } from "../models/profile";

export async function list(req: Request, res: Response) {
  const profile = await findProfileById(req.auth!.sub);
  const { status } = req.query as Record<string, string>;

  let clinicFilter: string | undefined = req.query.clinic as string | undefined;

  // Non-super-admins are locked to their assigned clinic only
  if (profile && profile.role !== "super_admin") {
    if (!profile.clinic_id) return res.json({ alerts: [] });
    const clinic = await findClinicById(profile.clinic_id);
    if (!clinic) return res.json({ alerts: [] });
    clinicFilter = clinic.name; // force override — ignore any query param
  }

  const { data, error } = await listAlerts({ clinicName: clinicFilter, status });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ alerts: data ?? [] });
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { status, assignedTo } = req.body as { status?: AlertStatus; assignedTo?: string | null };

  const patch: Parameters<typeof patchAlert>[1] = {};
  if (status) patch.status = status;
  if (assignedTo !== undefined) patch.assigned_to = assignedTo ?? null;
  if (status === "resolved") patch.resolved_at = new Date().toISOString();

  const { data, error } = await patchAlert(id, patch);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ alert: data });
}
