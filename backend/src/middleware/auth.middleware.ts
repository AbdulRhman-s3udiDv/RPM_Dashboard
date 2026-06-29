import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { findProfileById, type Role } from "../models/profile";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token." });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid or expired token." });

  req.auth = { sub: data.user.id, email: data.user.email ?? "" };
  next();
}

/** Must run after requireAuth. Loads the caller's profile and checks their role. */
export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Not authenticated." });

    const profile = await findProfileById(req.auth.sub);
    if (!profile) return res.status(403).json({ error: "No profile found for this account." });
    if (!roles.includes(profile.role)) return res.status(403).json({ error: "Not authorized." });

    req.profile = profile;
    next();
  };
}
