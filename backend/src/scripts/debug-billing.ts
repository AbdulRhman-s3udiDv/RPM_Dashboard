/**
 * Probes the billing endpoint with various date ranges to find where data lives.
 * Run:  npx tsx src/scripts/debug-billing.ts
 */
import "dotenv/config";

const BASE = "https://api.smartmeterrpm.com";
const API_KEY = "bb300d03cdffaf310b59428362aee111f0c6d27b51010814a3560b314060b0fa"; // 786 Medical

async function getJwt(): Promise<string> {
  const res = await fetch(`${BASE}/api/token`, { headers: { "X-API-KEY": API_KEY } });
  const body = await res.json() as { data: { jwt: string } };
  return body.data.jwt;
}

async function billing(jwt: string, start: string, end: string) {
  const res = await fetch(`${BASE}/api/patients/billing?start_date=${start}&end_date=${end}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const body = await res.json() as { data: unknown[] };
  const count = Array.isArray(body.data) ? body.data.length : "non-array";
  console.log(`  ${start} → ${end}: ${count} records`);
  if (Array.isArray(body.data) && body.data.length > 0) {
    console.log("  Sample:", JSON.stringify(body.data[0], null, 2).slice(0, 600));
  }
  return body.data;
}

async function run() {
  const jwt = await getJwt();
  console.log("Probing billing endpoint for 786 Medical PLLC\n");

  // Current month
  await billing(jwt, "2026-06-01", "2026-06-28");
  // Last month
  await billing(jwt, "2026-05-01", "2026-05-31");
  // May to now
  await billing(jwt, "2026-05-01", "2026-06-28");
  // Last 3 months
  await billing(jwt, "2026-04-01", "2026-06-28");
  // Try no date filters (just base endpoint)
  const res = await fetch(`${BASE}/api/patients/billing`, { headers: { Authorization: `Bearer ${jwt}` } });
  const body = await res.json() as { data: unknown[]; status: unknown };
  console.log(`\n  No dates: ${Array.isArray(body.data) ? body.data.length : "non-array"} records`);
  if (Array.isArray(body.data) && body.data.length > 0) {
    console.log("  Sample:", JSON.stringify(body.data[0], null, 2).slice(0, 600));
  }
}

run().catch(console.error);
