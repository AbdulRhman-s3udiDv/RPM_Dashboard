import cors from "cors";
import express from "express";
import { env } from "./env";
import { renderAcceptInvitePage } from "./pages/accept-invite";
import { adminRouter } from "./routes/admin.routes";
import { alertsRouter } from "./routes/alerts.routes";
import { authRouter } from "./routes/auth.routes";
import { clinicsRouter } from "./routes/clinics.routes";
import { dashboardRouter } from "./routes/dashboard.routes";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/accept-invite", (_req, res) => res.type("html").send(renderAcceptInvitePage()));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/clinics", clinicsRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/dashboard", dashboardRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

app.listen(env.PORT, () => {
  console.log(`RPMCares backend listening on port ${env.PORT}`);
});
