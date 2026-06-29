import { Router } from "express";
import { getClinics, postClinic, deleteClinicHandler, getClinicBreakdown } from "../controllers/clinics.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

export const clinicsRouter = Router();

clinicsRouter.get("/", requireAuth, requireRole("super_admin", "clinic_admin"), getClinics);
clinicsRouter.post("/", requireAuth, requireRole("super_admin"), postClinic);
clinicsRouter.delete("/:id", requireAuth, requireRole("super_admin"), deleteClinicHandler);
clinicsRouter.get("/breakdown", requireAuth, requireRole("super_admin", "clinic_admin"), getClinicBreakdown);
