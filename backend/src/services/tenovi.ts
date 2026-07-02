import crypto from "crypto";
import { env } from "../env";

const TENOVI_BASE = "https://api2.tenovi.com";

async function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ── TOTP (RFC 6238, SHA-1, 30s window) ────────────────────────────────────

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v !== -1) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  return Buffer.from(bytes);
}

function computeTOTP(secret: string): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  const code =
    (((h[offset] & 0x7f) << 24) |
      (h[offset + 1] << 16) |
      (h[offset + 2] << 8) |
      h[offset + 3]) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

// ── RPM token cache ────────────────────────────────────────────────────────
// CRITICAL: each new login invalidates ALL prior tokens.
// Use a pending-promise to deduplicate concurrent login attempts.

let _rpmToken: string | null = null;
let _rpmTokenExpiry = 0;
let _pendingLogin: Promise<string> | null = null;
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

async function doLogin(): Promise<string> {
  if (!env.TENOVI_USERNAME || !env.TENOVI_PASSWORD || !env.TENOVI_TOTP_SECRET) {
    throw new Error(
      "Tenovi RPM credentials not set (TENOVI_USERNAME, TENOVI_PASSWORD, TENOVI_TOTP_SECRET)"
    );
  }
  const otp = computeTOTP(env.TENOVI_TOTP_SECRET);
  const res = await fetch(`${TENOVI_BASE}/auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.tenovi.com" },
    body: JSON.stringify({
      username: env.TENOVI_USERNAME,
      password: env.TENOVI_PASSWORD,
      otp,
      otp_method: "A",
      session_cookie: crypto.randomUUID(),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tenovi auth → ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { token: string };
  _rpmToken = data.token;
  _rpmTokenExpiry = Date.now() + TOKEN_TTL_MS;
  return _rpmToken;
}

async function getRpmToken(): Promise<string> {
  if (_rpmToken && Date.now() < _rpmTokenExpiry) return _rpmToken;
  if (_pendingLogin) return _pendingLogin;
  _pendingLogin = doLogin().finally(() => {
    _pendingLogin = null;
  });
  return _pendingLogin;
}

// ── RPM API fetch (full URL — handles paginated `next` links) ─────────────

async function rpmFetch<T>(url: string): Promise<T> {
  const token = await getRpmToken();
  const res = await fetch(url, {
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Tenovi RPM ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── HWI API (Api-Key — gateway counts only) ───────────────────────────────

async function hwiGet<T>(path: string): Promise<T> {
  if (!env.TENOVI_API_KEY || !env.TENOVI_CLIENT_DOMAIN) {
    throw new Error("Tenovi HWI not configured (TENOVI_API_KEY, TENOVI_CLIENT_DOMAIN)");
  }
  const res = await fetch(
    `${TENOVI_BASE}/clients/${env.TENOVI_CLIENT_DOMAIN}${path}`,
    { headers: { Authorization: `Api-Key ${env.TENOVI_API_KEY}` } }
  );
  if (!res.ok) throw new Error(`Tenovi HWI ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Response types ─────────────────────────────────────────────────────────

type Facility = { id: string; name: string };

type PatientEnrollment = {
  patient: { id: string; devices: { module?: string }[] };
  status: string;
  review_time: number;             // seconds of clinical review this month
  number_of_measurements: number;
  date_of_service_99454: string | null;
};

type PatientsPage = { count: number; next: string | null; results: PatientEnrollment[] };
type PagedCount   = { count: number };

// ── Per-facility patient aggregation ──────────────────────────────────────

type FacilityAgg = {
  name: string;
  activePatients: number;
  rpmPatients: number;
  rtmPatients: number;
  totalDevices: number;
  with99454: number;
  with20min: number;
  patientsWithReadings: number;
};

async function fetchFacility(facility: Facility): Promise<FacilityAgg> {
  let url: string | null =
    `${TENOVI_BASE}/clients/rpmcares/rpm/facilities/${facility.id}/patients/?status=AC&page_size=500`;
  const patients: PatientEnrollment[] = [];
  while (url) {
    const page: PatientsPage = await rpmFetch<PatientsPage>(url);
    patients.push(...page.results);
    url = page.next ?? null;
  }

  let rpmPatients = 0, rtmPatients = 0, totalDevices = 0;
  let with99454 = 0, with20min = 0, patientsWithReadings = 0;

  for (const p of patients) {
    const module = p.patient.devices[0]?.module ?? "RPM";
    if (module === "RTM") rtmPatients++; else rpmPatients++;
    totalDevices += p.patient.devices.length;
    if (p.date_of_service_99454) with99454++;
    if (p.review_time >= 1200) with20min++;
    if (p.number_of_measurements > 0) patientsWithReadings++;
  }

  return {
    name: facility.name,
    activePatients: patients.length,
    rpmPatients,
    rtmPatients,
    totalDevices,
    with99454,
    with20min,
    patientsWithReadings,
  };
}

// ── Public types ───────────────────────────────────────────────────────────

export type TenoviFacilityItem = {
  name: string;
  activePatients: number;
  rpmPatients: number;
  rtmPatients: number;
  readingsCompliance: number;
  reviewCompliance: number;
};

export type TenoviSummary = {
  totalPatients: number;
  totalRpmPatients: number;
  totalRtmPatients: number;
  totalDevices: number;
  activeGateways: number;
  readingsCompliance: number;
  reviewCompliance: number;
  patientsWithReadings: number;
  facilityBreakdown: TenoviFacilityItem[];
};

// ── Patient sync helpers ───────────────────────────────────────────────────

export type TenoviPatientListItem = {
  patient: {
    id: string;
    name: string;
    phone_number: string;
    devices: Array<{ module?: string }>;
    enrolled_in_ccm: boolean;
  };
  status: string;
  ordering_physician: string;
  health_condition: string;
};

/** Fetch all active patients for a single facility (handles pagination) */
async function listFacilityPatients(facilityId: string): Promise<TenoviPatientListItem[]> {
  const all: TenoviPatientListItem[] = [];
  let url: string | null =
    `${TENOVI_BASE}/clients/rpmcares/rpm/facilities/${facilityId}/patients/?status=AC&page_size=500`;
  while (url) {
    const page = await rpmFetch<{
      count: number;
      next: string | null;
      results: TenoviPatientListItem[];
    }>(url);
    all.push(...(page.results ?? []));
    url = page.next ?? null;
  }
  return all;
}

type FacilityPatientsGroup = {
  facilityName: string;
  facilityId:   string;
  patients:     TenoviPatientListItem[];
};

/** Returns active Tenovi patients grouped by facility name. */
export async function listAllTenoviPatients(): Promise<FacilityPatientsGroup[]> {
  const facilities = await rpmFetch<Array<{ id: string; name: string }>>(
    `${TENOVI_BASE}/clients/rpmcares/facilities/`,
  );

  const results = await pLimit<FacilityPatientsGroup>(
    facilities.map((f) => async () => ({
      facilityName: f.name,
      facilityId:   f.id,
      patients:     await listFacilityPatients(f.id),
    })),
    5,
  );

  return results
    .filter((r): r is PromiseFulfilledResult<FacilityPatientsGroup> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ── Patient enrollment ─────────────────────────────────────────────────────

export async function getTenoviFacilities(): Promise<Array<{ id: string; name: string }>> {
  return rpmFetch<Array<{ id: string; name: string }>>(
    `${TENOVI_BASE}/clients/rpmcares/facilities/`,
  );
}

export async function enrollTenoviPatient(
  facilityId: string,
  data: {
    name: string;
    phone?: string;
    externalId: string;
    orderingPhysician?: string;
    healthCondition?: string;
  },
): Promise<{ patientId: string }> {
  const token = await getRpmToken();
  const res = await fetch(
    `${TENOVI_BASE}/clients/rpmcares/rpm/facilities/${facilityId}/patients/`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        patient: {
          name: data.name,
          phone_number: data.phone ?? "",
          external_id: data.externalId,
          enrolled_in_ccm: false,
        },
        ordering_physician: data.orderingPhysician ?? "",
        health_condition: data.healthCondition ?? "",
        status: "PE",
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tenovi enroll patient → ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as any;
  const patientId = json?.patient?.id ?? json?.id;
  if (!patientId) throw new Error("Tenovi patient creation returned no ID");
  return { patientId: String(patientId) };
}

// ── Main export ────────────────────────────────────────────────────────────

export async function getTenoviSummary(allowedClinicNames?: string[]): Promise<TenoviSummary> {
  const [facilitiesResult, gatewaysResult] = await Promise.allSettled([
    rpmFetch<Facility[]>(`${TENOVI_BASE}/clients/rpmcares/facilities/`),
    hwiGet<PagedCount>("/hwi/hwi-gateways/?page_size=1&last_measurement__isnull=false"),
  ]);

  let facilities =
    facilitiesResult.status === "fulfilled" ? facilitiesResult.value : [];
  const activeGateways =
    gatewaysResult.status === "fulfilled" ? gatewaysResult.value.count : 0;

  if (facilitiesResult.status === "rejected")
    console.warn("[tenovi] Facilities fetch failed:", facilitiesResult.reason);

  // Scope to the caller's clinic(s) — super_admin passes undefined (all facilities)
  if (allowedClinicNames?.length) {
    const allowed = new Set(allowedClinicNames.map((n) => n.toLowerCase().trim()));
    facilities = facilities.filter((f) => allowed.has(f.name.toLowerCase().trim()));
  }

  if (facilities.length === 0) {
    return {
      totalPatients: 0, totalRpmPatients: 0, totalRtmPatients: 0,
      totalDevices: 0, activeGateways,
      readingsCompliance: 0, reviewCompliance: 0,
      patientsWithReadings: 0, facilityBreakdown: [],
    };
  }

  // Process 5 facilities at a time — avoids concurrent token invalidation issues
  const facilityResults = await pLimit(
    facilities.map((f) => () => fetchFacility(f)),
    5,
  );

  const failed = facilityResults.filter((r) => r.status === "rejected").length;
  if (failed > 0)
    console.warn(`[tenovi] ${failed}/${facilities.length} facilities failed`);

  const aggs = facilityResults
    .filter((r): r is PromiseFulfilledResult<FacilityAgg> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((f) => f.activePatients > 0);

  const totalPatients        = aggs.reduce((s, f) => s + f.activePatients, 0);
  const totalRpmPatients     = aggs.reduce((s, f) => s + f.rpmPatients, 0);
  const totalRtmPatients     = aggs.reduce((s, f) => s + f.rtmPatients, 0);
  const totalDevices         = aggs.reduce((s, f) => s + f.totalDevices, 0);
  const totalWith99454       = aggs.reduce((s, f) => s + f.with99454, 0);
  const totalWith20min       = aggs.reduce((s, f) => s + f.with20min, 0);
  const totalWithReadings    = aggs.reduce((s, f) => s + f.patientsWithReadings, 0);

  const pct = (n: number) =>
    totalPatients > 0 ? Math.round((n / totalPatients) * 100) : 0;

  const facilityBreakdown: TenoviFacilityItem[] = aggs
    .map((f) => ({
      name: f.name,
      activePatients: f.activePatients,
      rpmPatients: f.rpmPatients,
      rtmPatients: f.rtmPatients,
      readingsCompliance:
        f.activePatients > 0
          ? Math.round((f.with99454 / f.activePatients) * 100)
          : 0,
      reviewCompliance:
        f.activePatients > 0
          ? Math.round((f.with20min / f.activePatients) * 100)
          : 0,
    }))
    .sort((a, b) => b.activePatients - a.activePatients);

  return {
    totalPatients,
    totalRpmPatients,
    totalRtmPatients,
    totalDevices,
    activeGateways,
    readingsCompliance: pct(totalWith99454),
    reviewCompliance:   pct(totalWith20min),
    patientsWithReadings: totalWithReadings,
    facilityBreakdown,
  };
}
