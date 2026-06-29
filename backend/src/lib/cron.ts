import cron from "node-cron";
import { runSync } from "./sync";

export function startCron(): void {
  // Fire once immediately on boot (non-blocking — server starts while sync happens).
  runSync().catch((err) => console.error("[cron] Initial sync error:", err));

  // Then every 30 minutes.
  cron.schedule("*/30 * * * *", () => {
    runSync().catch((err) => console.error("[cron] Scheduled sync error:", err));
  });

  console.log("[cron] Sync scheduler started — every 30 minutes");
}
