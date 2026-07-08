import { Router } from "express";
import { listNotes, createNote, updateNote, signNote, lockNote } from "../controllers/notes.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

export const notesRouter = Router();

notesRouter.get("/",          requireAuth, requireRole("super_admin","clinic_admin","staff"), listNotes);
notesRouter.post("/",         requireAuth, requireRole("super_admin","clinic_admin","staff"), createNote);
notesRouter.patch("/:id",     requireAuth, requireRole("super_admin","clinic_admin","staff"), updateNote);
notesRouter.post("/:id/sign", requireAuth, requireRole("super_admin","clinic_admin","staff"), signNote);
notesRouter.post("/:id/lock", requireAuth, requireRole("super_admin"), lockNote);
