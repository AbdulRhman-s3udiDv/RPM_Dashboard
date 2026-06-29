import { Router } from "express";
import { summary } from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const dashboardRouter = Router();
dashboardRouter.get("/summary", requireAuth, summary);
