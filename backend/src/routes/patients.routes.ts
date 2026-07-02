import { Router } from "express";
import { list, getOne, enroll, getSystemClinics } from "../controllers/patients.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

export const patientsRouter = Router();

// Static routes before /:id
patientsRouter.get(
  "/system-clinics",
  requireAuth,
  requireRole("super_admin", "clinic_admin"),
  getSystemClinics,
);
patientsRouter.post(
  "/enroll",
  requireAuth,
  requireRole("super_admin", "clinic_admin"),
  enroll,
);
patientsRouter.get(
  "/",
  requireAuth,
  requireRole("super_admin", "clinic_admin", "staff"),
  list,
);
patientsRouter.get(
  "/:id",
  requireAuth,
  requireRole("super_admin", "clinic_admin", "staff"),
  getOne,
);
