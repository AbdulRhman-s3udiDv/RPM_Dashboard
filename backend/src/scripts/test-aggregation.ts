/**
 * Tests real patient aggregation across all 22 clinics.
 * Run:  npx tsx src/scripts/test-aggregation.ts
 */
import "dotenv/config";
import { supabaseAdmin } from "../lib/supabase";
import { getSmartMeterSummary } from "../services/smartmeter";

async function run() {
  const { data: clinics, error } = await supabaseAdmin
    .from("clinics")
    .select("name, smartmeter_api_key")
    .not("smartmeter_api_key", "is", null);

  if (error) { console.error("DB error:", error.message); process.exit(1); }

  console.log(`Found ${clinics?.length ?? 0} clinics with API keys`);

  const clinicList = (clinics ?? [])
    .filter((c: { name: string; smartmeter_api_key: string | null }) => typeof c.smartmeter_api_key === "string" && c.smartmeter_api_key.length > 0)
    .map((c: { name: string; smartmeter_api_key: string }) => ({ name: c.name, apiKey: c.smartmeter_api_key }));

  console.log("Fetching from all clinics in parallel… (this takes ~10s)\n");
  const start = Date.now();
  const summary = await getSmartMeterSummary(clinicList);
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s\n`);
  console.log("=== AGGREGATED SUMMARY ===");
  console.log(`Total Patients:    ${summary.totalPatients}`);
  console.log(`Unread Alerts:     ${summary.unreadAlerts}`);
  console.log(`Open Tasks:        ${summary.openTasks}`);
  console.log(`Compliance Rate:   ${summary.complianceRate}%`);
  console.log(`Billing Readiness: ${summary.billingReadiness}%`);
  console.log(`Avg Review Time:   ${summary.reviewTimeMinutes} min`);
  console.log(`Top Alerts:        ${summary.topAlerts.length}`);
  if (summary.topAlerts.length > 0) {
    console.log("\nTop alert sample:", summary.topAlerts[0]);
  }
}

run().catch(console.error);
