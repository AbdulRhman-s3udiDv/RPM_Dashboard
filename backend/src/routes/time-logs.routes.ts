import { Router } from "express";
import { listTimeLogs, createTimeLog, updateTimeLog, deleteTimeLog } from "../controllers/time-logs.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

export const timeLogsRouter = Router();

timeLogsRouter.get("/",       requireAuth, requireRole("super_admin","clinic_admin","staff"), listTimeLogs);
timeLogsRouter.post("/",      requireAuth, requireRole("super_admin","clinic_admin","staff"), createTimeLog);
timeLogsRouter.patch("/:id",  requireAuth, requireRole("super_admin","clinic_admin","staff"), updateTimeLog);
timeLogsRouter.delete("/:id", requireAuth, requireRole("super_admin","clinic_admin","staff"), deleteTimeLog);
