import "express";
import type { ProfileRecord } from "../models/profile";

declare global {
  namespace Express {
    interface Request {
      auth?: { sub: string; email: string };
      profile?: ProfileRecord;
    }
  }
}

export {};
