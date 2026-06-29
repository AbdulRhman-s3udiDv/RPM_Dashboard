import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../env";
import { supabaseAdmin } from "../lib/supabase";
import { findClinicById } from "../models/clinic";
import { createProfile, findProfileById, listProfiles } from "../models/profile";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["clinic_admin", "staff"]),
  clinicId: z.string().uuid(),
});

export async function inviteMember(req: Request, res: Response) {
  const caller = req.profile!;
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "email, name, role and clinicId are required." });
  }
  const { email, name, role, clinicId } = parsed.data;

  if (caller.role === "clinic_admin") {
    if (role !== "staff") {
      return res.status(403).json({ error: "Clinic admins can only invite staff." });
    }
    if (clinicId !== caller.clinic_id) {
      return res.status(403).json({ error: "You can only invite staff into your own clinic." });
    }
  } else if (caller.role !== "super_admin") {
    return res.status(403).json({ error: "Not authorized." });
  }

  const clinic = await findClinicById(clinicId);
  if (!clinic) return res.status(400).json({ error: "Unknown clinic." });

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${env.APP_BASE_URL}/accept-invite`,
    data: { role, name, clinic_id: clinicId },
  });

  if (error || !data.user) {
    return res.status(400).json({ error: error?.message ?? "Could not send invite." });
  }

  await createProfile({
    id: data.user.id,
    email,
    role,
    name,
    clinicId,
    invitedBy: caller.id,
  });

  return res.status(201).json({ ok: true });
}

export async function listMembers(req: Request, res: Response) {
  const caller = req.profile!;

  if (caller.role === "super_admin") {
    const members = await listProfiles({ roles: ["clinic_admin", "staff"] });
    return res.json({ members });
  }

  if (caller.role === "clinic_admin") {
    const members = await listProfiles({ roles: ["staff"], clinicId: caller.clinic_id ?? undefined });
    return res.json({ members });
  }

  return res.status(403).json({ error: "Not authorized." });
}

export async function removeMember(req: Request, res: Response) {
  const caller = req.profile!;
  const targetId = req.params.id;

  const target = await findProfileById(targetId);
  if (!target) return res.status(404).json({ error: "Member not found." });

  if (caller.role === "clinic_admin") {
    if (target.role !== "staff" || target.clinic_id !== caller.clinic_id) {
      return res.status(403).json({ error: "You can only remove staff in your own clinic." });
    }
  } else if (caller.role === "super_admin") {
    if (target.role === "super_admin") {
      return res.status(403).json({ error: "Super admin accounts can't be removed here." });
    }
  } else {
    return res.status(403).json({ error: "Not authorized." });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) return res.status(400).json({ error: error.message });

  return res.json({ ok: true });
}
