import { Router } from "express";
import {
  getQueue, patchRecord,
  getRevenue,
  getRules, postRule, patchRule, deleteRule,
  getFeeSchedules, putFeeSchedule, deleteFeeScheduleHandler,
  getDosOffsets, patchDosOffset,
  getPatientBilling, setPatientCycle,
  triggerEvaluation,
} from "../controllers/billing.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

export const billingRouter = Router();

// ── Queue ──────────────────────────────────────────────────────────────────
billingRouter.get("/queue",          requireAuth, requireRole("super_admin","clinic_admin"), getQueue);
billingRouter.patch("/records/:id",  requireAuth, requireRole("super_admin","clinic_admin"), patchRecord);

// ── Revenue ────────────────────────────────────────────────────────────────
billingRouter.get("/revenue", requireAuth, requireRole("super_admin","clinic_admin"), getRevenue);

// ── Billing Rules (write: super_admin only) ────────────────────────────────
billingRouter.get("/rules",        requireAuth, requireRole("super_admin","clinic_admin"), getRules);
billingRouter.post("/rules",       requireAuth, requireRole("super_admin"), postRule);
billingRouter.patch("/rules/:id",  requireAuth, requireRole("super_admin"), patchRule);
billingRouter.delete("/rules/:id", requireAuth, requireRole("super_admin"), deleteRule);

// ── Fee Schedules (write: super_admin only) ────────────────────────────────
billingRouter.get("/fee-schedules",        requireAuth, requireRole("super_admin","clinic_admin"), getFeeSchedules);
billingRouter.put("/fee-schedules",        requireAuth, requireRole("super_admin"), putFeeSchedule);
billingRouter.delete("/fee-schedules/:id", requireAuth, requireRole("super_admin"), deleteFeeScheduleHandler);

// ── DOS Offsets (write: super_admin only) ─────────────────────────────────
billingRouter.get("/dos-offsets",        requireAuth, requireRole("super_admin","clinic_admin"), getDosOffsets);
billingRouter.patch("/dos-offsets/:id",  requireAuth, requireRole("super_admin"), patchDosOffset);

// ── Per-Patient Billing ────────────────────────────────────────────────────
billingRouter.get("/patients/:patientId",        requireAuth, requireRole("super_admin","clinic_admin","staff"), getPatientBilling);
billingRouter.post("/patients/:patientId/cycle", requireAuth, requireRole("super_admin","clinic_admin"), setPatientCycle);

// ── Manual Trigger (super_admin only) ─────────────────────────────────────
billingRouter.post("/evaluate", requireAuth, requireRole("super_admin"), triggerEvaluation);
