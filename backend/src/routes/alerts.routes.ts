import { Router } from "express";
import { list, update } from "../controllers/alerts.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const alertsRouter = Router();

alertsRouter.get("/", requireAuth, list);
alertsRouter.patch("/:id", requireAuth, update);
