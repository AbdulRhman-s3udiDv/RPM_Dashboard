import { env } from "../env";

const TENOVI_BASE = "https://api2.tenovi.com";

async function tenoviGet<T>(path: string): Promise<T> {
  if (!env.TENOVI_API_KEY || !env.TENOVI_CLIENT_DOMAIN) {
    throw new Error("Tenovi not configured");
  }
  const res = await fetch(`${TENOVI_BASE}/clients/${env.TENOVI_CLIENT_DOMAIN}${path}`, {
    headers: { Authorization: `Api-Key ${env.TENOVI_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Tenovi ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

type PagedResponse = { count: number; results: unknown[] };

export async function getTenoviSummary() {
  const [devices, gateways, patients] = await Promise.allSettled([
    tenoviGet<PagedResponse>("/hwi/hwi-devices/?page_size=1"),
    tenoviGet<PagedResponse>("/hwi/hwi-gateways/?page_size=1&last_measurement__isnull=false"),
    tenoviGet<PagedResponse>("/hwi/hwi-patients/?page_size=1"),
  ]);

  return {
    totalDevices: devices.status === "fulfilled" ? devices.value.count : 0,
    activeGateways: gateways.status === "fulfilled" ? gateways.value.count : 0,
    totalPatients: patients.status === "fulfilled" ? patients.value.count : 0,
  };
}
