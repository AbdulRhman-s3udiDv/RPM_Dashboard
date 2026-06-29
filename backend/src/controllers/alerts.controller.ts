import type { Request, Response } from "express";
import { listAlerts, patchAlert, type AlertStatus } from "../models/alert-event";

export async function list(req: Request, res: Response) {
  const { clinic, status } = req.query as Record<string, string>;
  const { data, error } = await listAlerts({ clinicName: clinic, status });
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
