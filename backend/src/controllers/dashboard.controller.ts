import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { findProfileById } from "../models/profile";
import { getTenoviSummary } from "../services/tenovi";
import { getSmartMeterSummary } from "../services/smartmeter";

const EMPTY_SMARTMETER = {
  totalPatients: 0, unreadAlerts: 0, openTasks: 0,
  complianceRate: 0, compliance20min: 0, billingReadiness: 0,
  reviewTimeMinutes: 0, topAlerts: [], clinicBreakdown: [],
};

const EMPTY_TENOVI = {
  totalPatients: 0, totalRpmPatients: 0, totalRtmPatients: 0,
  totalDevices: 0, activeGateways: 0, activeAlerts: 0,
  readingsCompliance: 0, reviewCompliance: 0,
  patientsWithReadings: 0, facilityBreakdown: [],
};

type ClinicRow = { name: string; smartmeter_api_key: string | null };

export async function summary(req: Request, res: Response) {
  const profile = await findProfileById(req.auth!.sub);
  const isSuperAdmin = !profile || profile.role === "super_admin";

  // Period filter: how many days of billing data to include (7 / 30 / 90)
  const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30));

  // Super admin reads from the background-sync cache (fast, < 100ms).
  // Non-super_admin always fetches live but scoped to a single clinic — still fast.
  // This prevents cross-tenant data leaks (topAlerts + billing fields are org-wide
  // aggregates that must not be exposed to individual clinic users).
  if (isSuperAdmin) {
    const { data: cache, error } = await supabaseAdmin
      .from("dashboard_cache")
      .select("tenovi, smartmeter, synced_at")
      .eq("id", 1)
      .single();

    if (error?.code === "42P01") {
      // Table hasn't been created yet — fall through to live fetch below.
      console.warn(
        "[dashboard] dashboard_cache table not found. " +
          "Run backend/src/migrations/001_dashboard_cache.sql in Supabase SQL Editor."
      );
    } else if (cache?.synced_at) {
      return res.json({
        tenovi:    cache.tenovi    ?? EMPTY_TENOVI,
        smartmeter: cache.smartmeter ?? EMPTY_SMARTMETER,
        cachedAt:  cache.synced_at,
      });
    }
    // Cache miss (first boot before sync completes) — fall through to live.
  }

  // ── Live fetch path ────────────────────────────────────────────────────
  let rows: ClinicRow[] = [];

  if (isSuperAdmin) {
    const { data } = await supabaseAdmin
      .from("clinics")
      .select("name, smartmeter_api_key")
      .not("smartmeter_api_key", "is", null);
    rows = data ?? [];
  } else if (profile?.clinic_id) {
    const { data } = await supabaseAdmin
      .from("clinics")
      .select("name, smartmeter_api_key")
      .eq("id", profile.clinic_id)
      .not("smartmeter_api_key", "is", null);
    rows = data ?? [];
  }

  const clinics = rows
    .filter((r): r is { name: string; smartmeter_api_key: string } =>
      typeof r.smartmeter_api_key === "string" && r.smartmeter_api_key.length > 0)
    .map((r) => ({ name: r.name, apiKey: r.smartmeter_api_key }));

  // For non-super-admin: pass clinic names so Tenovi only returns matching facilities
  const tenoviFilter = isSuperAdmin ? undefined : rows.map((r) => r.name);

  const [tenoviResult, smartmeterResult] = await Promise.allSettled([
    getTenoviSummary(tenoviFilter),
    getSmartMeterSummary(clinics, { days }),
  ]);

  return res.json({
    tenovi:    tenoviResult.status    === "fulfilled" ? tenoviResult.value    : EMPTY_TENOVI,
    smartmeter: smartmeterResult.status === "fulfilled" ? smartmeterResult.value : EMPTY_SMARTMETER,
    cachedAt:  null,
  });
}
