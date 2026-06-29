import { Router } from "express";
import { inviteMember, listMembers, removeMember } from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("super_admin", "clinic_admin"));
adminRouter.get("/members", listMembers);
adminRouter.post("/members/invite", inviteMember);
adminRouter.delete("/members/:id", removeMember);
