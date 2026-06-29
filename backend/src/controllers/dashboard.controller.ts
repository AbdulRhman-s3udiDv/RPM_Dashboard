import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { getTenoviSummary } from "../services/tenovi";
import { getSmartMeterSummary } from "../services/smartmeter";

export async function summary(_req: Request, res: Response) {
  const { data: rows } = await supabaseAdmin
    .from("clinics")
    .select("name, smartmeter_api_key")
    .not("smartmeter_api_key", "is", null);

  const clinics = (rows ?? [])
    .filter((r: { smartmeter_api_key: string | null }) => typeof r.smartmeter_api_key === "string" && r.smartmeter_api_key.length > 0)
    .map((r: { name: string; smartmeter_api_key: string }) => ({ name: r.name, apiKey: r.smartmeter_api_key }));

  const [tenoviResult, smartmeterResult] = await Promise.allSettled([
    getTenoviSummary(),
    getSmartMeterSummary(clinics),
  ]);

  const tenovi =
    tenoviResult.status === "fulfilled"
      ? tenoviResult.value
      : { totalDevices: 0, activeGateways: 0, totalPatients: 0 };

  const smartmeter =
    smartmeterResult.status === "fulfilled"
      ? smartmeterResult.value
      : {
          totalPatients: 0, unreadAlerts: 0, openTasks: 0,
          complianceRate: 0, compliance20min: 0, billingReadiness: 0,
          reviewTimeMinutes: 0, topAlerts: [], clinicBreakdown: [],
        };

  return res.json({ tenovi, smartmeter });
}
