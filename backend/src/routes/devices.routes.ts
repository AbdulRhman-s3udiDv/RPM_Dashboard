import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { getDevices, getOrders } from "../controllers/devices.controller";

export const devicesRouter = Router();

devicesRouter.get(
  "/",
  requireAuth,
  requireRole("super_admin", "clinic_admin", "staff"),
  getDevices,
);

devicesRouter.get(
  "/orders",
  requireAuth,
  requireRole("super_admin", "clinic_admin", "staff"),
  getOrders,
);
