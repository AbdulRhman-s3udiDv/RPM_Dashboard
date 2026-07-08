import { Router } from "express";
import { listCommunications, createCommunication } from "../controllers/communications.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

export const communicationsRouter = Router();

communicationsRouter.get("/",  requireAuth, requireRole("super_admin","clinic_admin","staff"), listCommunications);
communicationsRouter.post("/", requireAuth, requireRole("super_admin","clinic_admin","staff"), createCommunication);
