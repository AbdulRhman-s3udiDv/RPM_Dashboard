const BASE = "https://api.smartmeterrpm.com";

// ── JWT cache (tokens expire in 30 min; refresh after 25) ─────────────────
const tokenCache = new Map<string, { jwt: string; expiresAt: number }>();

async function getJwt(apiKey: string): Promise<string> {
  const cached = tokenCache.get(apiKey);
  if (cached && Date.now() < cached.expiresAt) return cached.jwt;
  const res = await fetch(`${BASE}/api/token`, { headers: { "X-API-KEY": apiKey } });
  if (!res.ok) throw new Error(`SmartMeter /api/token → ${res.status}`);
  const body = (await res.json()) as { data: { jwt: string } };
  const jwt = body.data.jwt;
  tokenCache.set(apiKey, { jwt, expiresAt: Date.now() + 25 * 60 * 1000 });
  return jwt;
}

const REQUEST_TIMEOUT_MS = 20_000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function smGet<T>(apiKey: string, path: string): Promise<T> {
  const jwt = await getJwt(apiKey);
  const res = await fetchWithTimeout(`${BASE}${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`SmartMeter ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function smPost<T>(apiKey: string, path: string, body: object): Promise<T> {
  const jwt = await getJwt(apiKey);
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`SmartMeter POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── response shapes ────────────────────────────────────────────────────────
export type AlertItem = {
  alert_id: number;
  patient_name: string;
  patient_id: number;
  alert_date: string;
  alert_type: string;
  alert_threshold: number;
  reading_value: number;
};

type AlertListResp = { data: { alerts: AlertItem[] } };

type BillingRecord = {
  id: number;
  patient_id: number;
  is_billed: boolean;
  cpt_codes: { cpt_code: string; quantity: number }[];
  meta: { review_time_seconds: number } | null;
};
type BillingResp = { data: BillingRecord[] };

type ReadingItem = { patient_id: number; date_recorded: string };
type ReadingsResp = { data: ReadingItem[] };

type WorklistResp = { data: { page: unknown[]; page_info: { total_records: number } } | string };

// ── helpers ────────────────────────────────────────────────────────────────
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function isoDateTime(d: Date) { return d.toISOString().slice(0, 19); }

function currentMonthRange() {
  const now = new Date();
  return {
    start: isoDateTime(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: isoDateTime(now),
  };
}

// 60-day window to capture the most recently closed billing period
function billingRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 60);
  return { start: isoDate(start), end: isoDate(now) };
}

function hasCpt(record: BillingRecord, ...codes: string[]) {
  return record.cpt_codes?.some((c) => codes.includes(c.cpt_code)) ?? false;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[smartmeter] "${label}" failed, retrying in 5s… (${msg})`);
    await new Promise((r) => setTimeout(r, 5000));
    return fn();
  }
}

async function fetchPatientCount(apiKey: string, clinicName: string): Promise<number> {
  let page = 1, total = 0;
  while (true) {
    const res = await withRetry(
      () => smGet<{ data: unknown[] }>(apiKey, `/api/patients?page=${page}&size=100`),
      `${clinicName} patients p${page}`,
    );
    const count = res.data?.length ?? 0;
    total += count;
    if (count < 100) break;
    page++;
    if (page > 100) break;
  }
  return total;
}

// Count patients with 16+ distinct reading days this month from actual readings
async function fetchReadingsCompliance(apiKey: string): Promise<number> {
  const { start, end } = currentMonthRange();
  const resp = await smPost<ReadingsResp>(apiKey, "/api/readings", {
    date_start: start,
    date_end: end,
  });
  const readings = resp.data ?? [];
  const daysByPatient = new Map<number, Set<string>>();
  for (const r of readings) {
    const day = r.date_recorded?.slice(0, 10) ?? "";
    if (!day) continue;
    if (!daysByPatient.has(r.patient_id)) daysByPatient.set(r.patient_id, new Set());
    daysByPatient.get(r.patient_id)!.add(day);
  }
  return [...daysByPatient.values()].filter((days) => days.size >= 16).length;
}

// ── per-clinic fetch ───────────────────────────────────────────────────────
type ClinicRaw = {
  name: string;
  totalPatients: number;
  compliant16: number;  // patients with 16+ distinct reading days this month
  unreadAlerts: number;
  openTasks: number;
  billingCount: number;
  compliant20: number;  // billing records with CPT 99457/99490 (20+ min)
  unbilled: number;
  reviewTimeSeconds: number;
  topAlerts: AlertItem[];
};

async function fetchClinic(name: string, apiKey: string): Promise<ClinicRaw> {
  const { start, end } = billingRange();

  const [patientsRes, readingsRes, alertsRes, billingRes, worklistRes] = await Promise.allSettled([
    fetchPatientCount(apiKey, name),
    fetchReadingsCompliance(apiKey),
    smGet<AlertListResp>(apiKey, "/api/patients/alerts/group?alert_status=unread&page=1&size=1000"),
    smGet<BillingResp>(apiKey, `/api/patients/billing?start_date=${start}&end_date=${end}`),
    smGet<WorklistResp>(apiKey, "/api/worklist/get-worklist?Status=OPEN&page=1&size=1"),
  ]);

  // Log any per-endpoint failures so we can diagnose which API call is flaky
  const endpoints = ["patients", "readings", "alerts", "billing", "worklist"];
  [patientsRes, readingsRes, alertsRes, billingRes, worklistRes].forEach((r, i) => {
    if (r.status === "rejected") {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.warn(`[smartmeter] "${name}" ${endpoints[i]} failed: ${msg}`);
    }
  });

  const totalPatients  = patientsRes.status === "fulfilled"  ? patientsRes.value : 0;
  const compliant16    = readingsRes.status === "fulfilled"  ? readingsRes.value  : 0;
  const allAlerts      = alertsRes.status === "fulfilled"    ? (alertsRes.value.data?.alerts ?? [])  : [];
  const billingRecords = billingRes.status === "fulfilled"   ? (billingRes.value.data ?? [])         : [];

  const billingCount      = billingRecords.length;
  const compliant20       = billingRecords.filter((r) => hasCpt(r, "99457", "99490")).length;
  const unbilled          = billingRecords.filter((r) => !r.is_billed).length;
  const reviewTimeSeconds = billingRecords.reduce((s, r) => s + (r.meta?.review_time_seconds ?? 0), 0);

  let openTasks = 0;
  if (worklistRes.status === "fulfilled") {
    const d = worklistRes.value.data;
    if (d && typeof d === "object" && "page_info" in d) {
      openTasks = (d as { page_info: { total_records: number } }).page_info.total_records ?? 0;
    }
  }

  return {
    name, totalPatients, compliant16, unreadAlerts: allAlerts.length, openTasks,
    billingCount, compliant20, unbilled, reviewTimeSeconds,
    topAlerts: allAlerts.slice(0, 5),
  };
}

// ── public types ───────────────────────────────────────────────────────────
export type ClinicBreakdownItem = {
  name: string;
  totalPatients: number;
  complianceRate: number;
  unreadAlerts: number;
  openTasks: number;
};

export type SmartMeterSummary = {
  totalPatients: number;
  unreadAlerts: number;
  openTasks: number;
  complianceRate: number;    // % patients with 16+ distinct reading days this month
  compliance20min: number;   // % billing records with CPT 99457/99490 (20+ min)
  billingReadiness: number;  // % billing records not yet submitted
  reviewTimeMinutes: number;
  topAlerts: AlertItem[];
  clinicBreakdown: ClinicBreakdownItem[];
};

// ── main export ────────────────────────────────────────────────────────────
export async function getSmartMeterSummary(
  clinics: { name: string; apiKey: string }[],
): Promise<SmartMeterSummary> {
  if (clinics.length === 0) {
    return {
      totalPatients: 0, unreadAlerts: 0, openTasks: 0,
      complianceRate: 0, compliance20min: 0, billingReadiness: 0,
      reviewTimeMinutes: 0, topAlerts: [], clinicBreakdown: [],
    };
  }

  const results = await Promise.allSettled(
    clinics.map((c) => withRetry(() => fetchClinic(c.name, c.apiKey), c.name)),
  );

  const ok = results
    .filter((r): r is PromiseFulfilledResult<ClinicRaw> => r.status === "fulfilled")
    .map((r) => r.value);

  const failedResults = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failedResults.length > 0) {
    console.warn(`[smartmeter] ${failedResults.length}/${clinics.length} clinics failed after retry:`);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        console.warn(`  · ${clinics[i].name}: ${msg}`);
      }
    });
  }

  const totalPatients   = ok.reduce((s, c) => s + c.totalPatients, 0);
  const totalCompliant16 = ok.reduce((s, c) => s + c.compliant16,  0);
  const unreadAlerts    = ok.reduce((s, c) => s + c.unreadAlerts,  0);
  const openTasks       = ok.reduce((s, c) => s + c.openTasks,     0);
  const totalBilling    = ok.reduce((s, c) => s + c.billingCount,  0);
  const totalCompliant20 = ok.reduce((s, c) => s + c.compliant20,  0);
  const totalUnbilled   = ok.reduce((s, c) => s + c.unbilled,      0);
  const totalReviewSecs = ok.reduce((s, c) => s + c.reviewTimeSeconds, 0);

  // Compliance = compliant patients / total enrolled patients
  const complianceRate   = totalPatients > 0 ? Math.round((totalCompliant16 / totalPatients) * 100) : 0;
  // 20-min = billing records with 20+ min CPT / total billing records
  const compliance20min  = totalBilling  > 0 ? Math.round((totalCompliant20 / totalBilling)  * 100) : 0;
  // Billing readiness = unbilled / total billing records
  const billingReadiness = totalBilling  > 0 ? Math.round((totalUnbilled    / totalBilling)  * 100) : 0;
  const reviewTimeMinutes = totalBilling > 0 ? Math.round(totalReviewSecs / totalBilling / 60) : 0;

  const allAlerts = ok.flatMap((c) => c.topAlerts);
  allAlerts.sort((a, b) => new Date(b.alert_date).getTime() - new Date(a.alert_date).getTime());

  const clinicBreakdown: ClinicBreakdownItem[] = ok
    .map((c) => ({
      name: c.name,
      totalPatients: c.totalPatients,
      // Per-clinic compliance: compliant16 / totalPatients
      complianceRate: c.totalPatients > 0 ? Math.round((c.compliant16 / c.totalPatients) * 100) : 0,
      unreadAlerts: c.unreadAlerts,
      openTasks: c.openTasks,
    }))
    .sort((a, b) => b.totalPatients - a.totalPatients);

  return {
    totalPatients, unreadAlerts, openTasks,
    complianceRate, compliance20min, billingReadiness, reviewTimeMinutes,
    topAlerts: allAlerts.slice(0, 5),
    clinicBreakdown,
  };
}
