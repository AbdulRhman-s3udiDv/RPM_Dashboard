import { supabaseAdmin } from "./supabase";
import { getTenoviSummary } from "../services/tenovi";
import { getSmartMeterSummary } from "../services/smartmeter";

type ClinicRow = { name: string; smartmeter_api_key: string | null };

export async function runSync(): Promise<void> {
  console.log("[sync] Starting background sync…");
  const start = Date.now();

  // Fetch all clinics that have a SmartMeter key
  const { data, error: dbErr } = await supabaseAdmin
    .from("clinics")
    .select("name, smartmeter_api_key")
    .not("smartmeter_api_key", "is", null);

  if (dbErr) {
    console.error("[sync] Failed to load clinics:", dbErr.message);
    return;
  }

  const clinics = ((data as ClinicRow[]) ?? [])
    .filter(
      (r): r is { name: string; smartmeter_api_key: string } =>
        typeof r.smartmeter_api_key === "string" && r.smartmeter_api_key.length > 0
    )
    .map((r) => ({ name: r.name, apiKey: r.smartmeter_api_key }));

  const [tenoviResult, smartmeterResult] = await Promise.allSettled([
    getTenoviSummary(),
    getSmartMeterSummary(clinics),
  ]);

  if (tenoviResult.status === "rejected")
    console.error("[sync] Tenovi failed:", tenoviResult.reason);
  if (smartmeterResult.status === "rejected")
    console.error("[sync] SmartMeter failed:", smartmeterResult.reason);

  if (tenoviResult.status === "rejected" && smartmeterResult.status === "rejected") {
    console.error("[sync] Both sources failed — cache unchanged");
    return;
  }

  const tenovi    = tenoviResult.status    === "fulfilled" ? tenoviResult.value    : {};
  const smartmeter = smartmeterResult.status === "fulfilled" ? smartmeterResult.value : {};

  const { error: upsertErr } = await supabaseAdmin
    .from("dashboard_cache")
    .upsert(
      { id: 1, tenovi, smartmeter, synced_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (upsertErr) {
    if (upsertErr.code === "42P01") {
      console.error(
        "[sync] dashboard_cache table not found.\n" +
          "       Run: backend/src/migrations/001_dashboard_cache.sql in Supabase SQL Editor"
      );
    } else {
      console.error("[sync] Cache write failed:", upsertErr.message);
    }
  } else {
    console.log(`[sync] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }
}
