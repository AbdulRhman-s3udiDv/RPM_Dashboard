import { Router } from "express";
import { login, me, patchMe, refreshToken } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/refresh", refreshToken);
authRouter.get("/me", requireAuth, me);
authRouter.patch("/me", requireAuth, patchMe);
