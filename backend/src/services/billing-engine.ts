import { supabaseAdmin } from "../lib/supabase";
import type { BillingRule, DosOffset } from "../models/billing";

// ── Patient program → which billing rule categories apply ─────────────────
const PROGRAM_RULE_MAP: Record<string, string[]> = {
  RPM: ["RPM", "Device", "Installation", "99091"],
  RTM: ["RTM", "Installation", "99091"],
  CCM: ["CCM", "99091"],
  PCM: ["PCM", "99091"],
};

// ── In-memory cache (refreshed each sync cycle) ────────────────────────────
let _rules: BillingRule[] = [];
let _feeMap  = new Map<string, Map<string, number>>(); // payer → cpt → amount
let _dosMap  = new Map<string, Map<string, DosOffset>>(); // category/program → cpt → offset
let _cacheExpiry = 0;

async function ensureCache(): Promise<void> {
  if (Date.now() < _cacheExpiry) return;

  const [rulesRes, feesRes, offsetsRes] = await Promise.all([
    supabaseAdmin.from("billing_rules").select("*").eq("is_active", true).order("sort_order"),
    supabaseAdmin.from("fee_schedules").select("*").is("end_date", null),
    supabaseAdmin.from("dos_offsets").select("*"),
  ]);

  _rules = rulesRes.data ?? [];

  _feeMap = new Map();
  for (const f of feesRes.data ?? []) {
    if (!_feeMap.has(f.payer)) _feeMap.set(f.payer, new Map());
    _feeMap.get(f.payer)!.set(f.cpt_code, parseFloat(f.amount));
  }

  _dosMap = new Map();
  for (const d of offsetsRes.data ?? []) {
    if (!_dosMap.has(d.program)) _dosMap.set(d.program, new Map());
    _dosMap.get(d.program)!.set(d.cpt_code, d);
  }

  _cacheExpiry = Date.now() + 30 * 60 * 1000; // 30-min TTL
}

export function invalidateCache(): void {
  _cacheExpiry = 0;
}

// ── DOS calculation ────────────────────────────────────────────────────────

export function calculateDOS(
  cptCode: string,
  patientProgram: string,
  ruleCategory: string,
  cycleStart: Date,
  shipmentDate?: Date | null,
): Date {
  // Check patient-program-specific offset, then rule-category offset (for Installation)
  const offset =
    _dosMap.get(patientProgram)?.get(cptCode) ??
    _dosMap.get(ruleCategory)?.get(cptCode);

  if (!offset || offset.offset_type === "shipment_date") {
    return shipmentDate ?? new Date(cycleStart);
  }
  const dos = new Date(cycleStart);
  dos.setDate(dos.getDate() + (offset.offset_days ?? 0));
  return dos;
}

// ── Insurance normalisation ────────────────────────────────────────────────

export function normalizeInsurance(
  insuranceClass: string | null,
  insurancePayer: string | null,
): string {
  const raw = (insuranceClass ?? insurancePayer ?? "").toLowerCase();
  if (raw.includes("medicaid"))                                                       return "Medicaid";
  if (raw.includes("advantage") || raw.includes("mapd") || raw.includes("ma plan")) return "Medicare Advantage";
  if (
    raw.includes("commercial") || raw.includes("private") ||
    raw.includes("bcbs") || raw.includes("aetna") || raw.includes("cigna") ||
    raw.includes("united") || raw.includes("humana") || raw.includes("blue cross")
  )                                                                                    return "Commercial";
  if (raw.includes("medicare"))                                                       return "Medicare";
  return "Medicare"; // safest default
}

function getProjectedAmount(cptCode: string, insuranceType: string): number {
  return (
    _feeMap.get(insuranceType)?.get(cptCode) ??
    _feeMap.get("Medicare")?.get(cptCode) ??
    0
  );
}

// ── Evaluate one patient ───────────────────────────────────────────────────

export async function evaluatePatientBilling(patientId: string): Promise<void> {
  await ensureCache();

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("id, clinic_id, program, insurance_class, insurance_payer, enrolled_at")
    .eq("id", patientId)
    .single();
  if (!patient) return;

  const insuranceType        = normalizeInsurance(patient.insurance_class, patient.insurance_payer);
  const applicableCategories = PROGRAM_RULE_MAP[patient.program] ?? [];

  // Determine current billing cycle
  const { data: cycleRow } = await supabaseAdmin
    .from("billing_cycles")
    .select("cycle_start, shipment_date")
    .eq("patient_id", patientId)
    .order("cycle_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build the cycle start string directly — never convert through toISOString()
  // because new Date("YYYY-MM-DD") is UTC midnight, and setHours(local) then
  // toISOString() shifts the date backwards in UTC+ timezones.
  const now = new Date();
  const defaultCycleStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const cycleStartStr = cycleRow?.cycle_start ?? defaultCycleStart;

  // Parse cycle start as LOCAL date for arithmetic (DOS calc, time-log filter)
  const [csY, csM, csD] = cycleStartStr.split("-").map(Number);
  const cycleStartDate = new Date(csY, csM - 1, csD, 0, 0, 0, 0);

  const cycleEndDate = new Date(csY, csM - 1, csD + 30, 0, 0, 0, 0);
  const cycleEndStr  = `${cycleEndDate.getFullYear()}-${String(cycleEndDate.getMonth() + 1).padStart(2, "0")}-${String(cycleEndDate.getDate()).padStart(2, "0")}`;

  const shipmentDate = cycleRow?.shipment_date ? (() => {
    const [sy, sm, sd] = cycleRow.shipment_date.split("-").map(Number);
    return new Date(sy, sm - 1, sd);
  })() : null;

  // Reading count for this cycle
  const { data: stats } = await supabaseAdmin
    .from("patient_cycle_stats")
    .select("reading_count")
    .eq("patient_id", patientId)
    .eq("cycle_start", cycleStartStr)
    .maybeSingle();
  const readingCount = stats?.reading_count ?? 0;

  // Total clinical time for this cycle
  const { data: timeLogs } = await supabaseAdmin
    .from("time_logs")
    .select("duration_seconds")
    .eq("patient_id", patientId)
    .gte("logged_at", cycleStartDate.toISOString())
    .lt("logged_at", cycleEndDate.toISOString());
  const totalMinutes = Math.floor(
    (timeLogs ?? []).reduce((s, t) => s + t.duration_seconds, 0) / 60,
  );

  // Match applicable billing rules
  const matchedRules = _rules.filter((rule) => {
    if (!applicableCategories.includes(rule.rule_category)) return false;
    if (rule.insurance_type !== "Any" && rule.insurance_type !== insuranceType) return false;
    if (rule.min_readings   != null && readingCount  < rule.min_readings)   return false;
    if (rule.max_readings   != null && readingCount  > rule.max_readings)   return false;
    if (rule.trigger_minutes != null && totalMinutes < rule.trigger_minutes) return false;
    return true;
  });

  if (matchedRules.length === 0) return;

  // Deduplicate: for the same CPT code across multiple rules, use the higher unit count
  const cptMap = new Map<string, { units: number; ruleCategory: string; isOneTime: boolean }>();
  for (const rule of matchedRules) {
    const seenInRule = new Map<string, number>();
    for (const cpt of rule.cpt_codes) {
      seenInRule.set(cpt, (seenInRule.get(cpt) ?? 0) + 1);
    }
    for (const [cpt, units] of seenInRule) {
      const existing = cptMap.get(cpt);
      if (!existing || units > existing.units) {
        cptMap.set(cpt, { units, ruleCategory: rule.rule_category, isOneTime: rule.is_one_time });
      }
    }
  }

  // Check which one-time codes were already billed (any cycle, not voided)
  const oneTimeCpts = [...cptMap.entries()]
    .filter(([, v]) => v.isOneTime)
    .map(([cpt]) => cpt);

  const alreadyBilledOneTime = new Set<string>();
  if (oneTimeCpts.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from("billing_records")
      .select("cpt_code")
      .eq("patient_id", patientId)
      .in("cpt_code", oneTimeCpts)
      .neq("status", "voided");
    for (const r of existing ?? []) alreadyBilledOneTime.add(r.cpt_code);
  }

  // Upsert one billing record per CPT
  const updatedAt = new Date().toISOString();
  for (const [cptCode, { units, ruleCategory, isOneTime }] of cptMap) {
    if (isOneTime && alreadyBilledOneTime.has(cptCode)) continue;

    const dos = calculateDOS(cptCode, patient.program, ruleCategory, cycleStartDate, shipmentDate);
    const projectedAmount = getProjectedAmount(cptCode, insuranceType);

    // status intentionally omitted: SQL DEFAULT 'pending' applies on INSERT;
    // existing records in reviewed/submitted/paid keep their status on UPDATE.
    await supabaseAdmin.from("billing_records").upsert(
      {
        patient_id:       patientId,
        clinic_id:        patient.clinic_id,
        cycle_start:      cycleStartStr,
        cycle_end:        cycleEndStr,
        cpt_code:         cptCode,
        units,
        dos:              dos.toISOString().split("T")[0],
        program:          patient.program,
        insurance_type:   insuranceType,
        reading_count:    readingCount,
        total_minutes:    totalMinutes,
        projected_amount: projectedAmount > 0 ? projectedAmount : null,
        updated_at:       updatedAt,
      },
      {
        onConflict: "patient_id,cycle_start,cpt_code",
        ignoreDuplicates: false,
      },
    );
  }
}

// ── Bulk evaluation (runs after each sync) ─────────────────────────────────

export async function runBillingEvaluation(): Promise<void> {
  console.log("[billing] Starting evaluation for all active patients…");
  await ensureCache();

  const { data: patients, error } = await supabaseAdmin
    .from("patients")
    .select("id")
    .eq("enrollment_status", "active")
    .limit(5000);

  if (error) {
    console.error("[billing] Failed to load patients:", error.message);
    return;
  }

  let ok = 0, fail = 0;
  for (const p of patients ?? []) {
    try {
      await evaluatePatientBilling(p.id);
      ok++;
    } catch (err) {
      fail++;
      if (fail <= 3) console.warn(`[billing] evaluate ${p.id} failed:`, err);
    }
  }

  console.log(`[billing] Evaluation complete — ${ok} ok, ${fail} failed`);
}
