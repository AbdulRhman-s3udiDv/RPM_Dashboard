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

// express-async-errors patches Express internals and has no own exports
declare module "express-async-errors";

export {};
