import { supabaseAdmin } from "./supabase";
import { getTenoviSummary, listAllTenoviPatients } from "../services/tenovi";
import { getSmartMeterSummary, listSmartMeterPatients } from "../services/smartmeter";

type ClinicRow = { id: string; name: string; smartmeter_api_key: string | null };

// ── Patient roster sync ────────────────────────────────────────────────────

async function syncPatients(clinics: ClinicRow[]): Promise<void> {
  console.log("[sync:patients] Starting patient roster sync…");

  const clinicByName = new Map(
    clinics.map((c) => [c.name.toLowerCase().trim(), c.id]),
  );

  const smClinics = clinics.filter(
    (c): c is { id: string; name: string; smartmeter_api_key: string } =>
      typeof c.smartmeter_api_key === "string" && c.smartmeter_api_key.length > 0,
  );

  const [tenoviResult, smGroupResult] = await Promise.allSettled([
    listAllTenoviPatients(),
    Promise.allSettled(
      smClinics.map(async (c) => ({
        clinicId: c.id,
        patients: await listSmartMeterPatients(c.smartmeter_api_key),
      })),
    ),
  ]);

  if (tenoviResult.status === "rejected")
    console.warn("[sync:patients] Tenovi fetch failed:", tenoviResult.reason);
  if (smGroupResult.status === "rejected")
    console.warn("[sync:patients] SmartMeter fetch failed:", smGroupResult.reason);

  const rows: Record<string, unknown>[] = [];

  if (tenoviResult.status === "fulfilled") {
    for (const { facilityName, patients } of tenoviResult.value) {
      const clinicId = clinicByName.get(facilityName.toLowerCase().trim());
      if (!clinicId) continue;

      for (const en of patients) {
        const module   = en.patient.devices?.[0]?.module ?? "RPM";
        const diagnoses = en.health_condition ? [en.health_condition] : [];
        rows.push({
          source:              "tenovi",
          external_patient_id: en.patient.id,
          clinic_id:           clinicId,
          full_name:           en.patient.name || "Unknown",
          phone:               en.patient.phone_number || null,
          program:             module === "RTM" ? "RTM" : "RPM",
          diagnoses,
          enrollment_status:   "active",
          consent:             true,
          risk:                "low",
          language:            "EN",
        });
      }
    }
  }

  if (smGroupResult.status === "fulfilled") {
    for (const r of smGroupResult.value) {
      if (r.status === "rejected") {
        console.warn("[sync:patients] SmartMeter clinic failed:", r.reason);
        continue;
      }
      const { clinicId, patients } = r.value;
      for (const p of patients) {
        const diagnoses = p.primary_diagnosis ? [p.primary_diagnosis] : [];
        rows.push({
          source:              "smartmeter",
          external_patient_id: String(p.patient_id),
          clinic_id:           clinicId,
          full_name:           [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Unknown",
          dob:                 p.dob || null,
          sex:                 p.sex || null,
          phone:               p.phone || null,
          language:            p.language || "EN",
          insurance_payer:     p.insurance_type || null,
          program:             "RPM",
          diagnoses,
          enrollment_status:   "active",
          consent:             true,
          risk:                "low",
        });
      }
    }
  }

  if (rows.length === 0) {
    console.log("[sync:patients] No patients to sync.");
    return;
  }

  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("patients")
      .upsert(chunk, { onConflict: "source,external_patient_id" });
    if (error) {
      console.error(`[sync:patients] Chunk ${i} failed:`, error.message);
    } else {
      upserted += chunk.length;
    }
  }

  console.log(`[sync:patients] ${upserted} / ${rows.length} patients upserted.`);
}

// ── Main sync ──────────────────────────────────────────────────────────────

export async function runSync(): Promise<void> {
  console.log("[sync] Starting background sync…");
  const start = Date.now();

  const { data, error: dbErr } = await supabaseAdmin
    .from("clinics")
    .select("id, name, smartmeter_api_key");

  if (dbErr) {
    console.error("[sync] Failed to load clinics:", dbErr.message);
    return;
  }

  const allClinics = (data as ClinicRow[]) ?? [];
  const smClinics  = allClinics
    .filter((r): r is { id: string; name: string; smartmeter_api_key: string } =>
      typeof r.smartmeter_api_key === "string" && r.smartmeter_api_key.length > 0,
    )
    .map((r) => ({ name: r.name, apiKey: r.smartmeter_api_key }));

  const [tenoviResult, smartmeterResult, patientSyncResult] = await Promise.allSettled([
    getTenoviSummary(),
    getSmartMeterSummary(smClinics),
    syncPatients(allClinics),
  ]);

  if (tenoviResult.status    === "rejected") console.error("[sync] Tenovi dashboard failed:",   tenoviResult.reason);
  if (smartmeterResult.status === "rejected") console.error("[sync] SmartMeter dashboard failed:", smartmeterResult.reason);
  if (patientSyncResult.status === "rejected") console.error("[sync] Patient sync failed:",      patientSyncResult.reason);

  if (tenoviResult.status === "rejected" && smartmeterResult.status === "rejected") {
    console.error("[sync] Both dashboard sources failed — cache unchanged");
    return;
  }

  const tenovi     = tenoviResult.status     === "fulfilled" ? tenoviResult.value     : {};
  const smartmeter = smartmeterResult.status === "fulfilled" ? smartmeterResult.value : {};

  const { error: upsertErr } = await supabaseAdmin
    .from("dashboard_cache")
    .upsert(
      { id: 1, tenovi, smartmeter, synced_at: new Date().toISOString() },
      { onConflict: "id" },
    );

  if (upsertErr) {
    if (upsertErr.code === "42P01") {
      console.error(
        "[sync] dashboard_cache table not found.\n" +
          "       Run: backend/src/migrations/001_dashboard_cache.sql in Supabase SQL Editor",
      );
    } else {
      console.error("[sync] Cache write failed:", upsertErr.message);
    }
  } else {
    console.log(`[sync] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }
}
