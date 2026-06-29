import "dotenv/config";

const BASE = "https://api.smartmeterrpm.com";
const API_KEY = "bb300d03cdffaf310b59428362aee111f0c6d27b51010814a3560b314060b0fa";

async function getJwt() {
  const res = await fetch(`${BASE}/api/token`, { headers: { "X-API-KEY": API_KEY } });
  return ((await res.json()) as { data: { jwt: string } }).data.jwt;
}

async function post(jwt: string, path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { data: unknown; status: { code: number } };
  console.log(`\n=== POST ${path} (${res.status}) ===`);
  const arr = Array.isArray(data.data) ? data.data : null;
  console.log(`Records: ${arr ? arr.length : "non-array"}`);
  if (arr && arr.length > 0) console.log("Sample:", JSON.stringify(arr[0], null, 2).slice(0, 600));
  return arr;
}

async function run() {
  const jwt = await getJwt();

  // Try last 30 days
  const readings = await post(jwt, "/api/readings", {
    date_start: "2026-06-01T00:00:00",
    date_end:   "2026-06-28T23:59:59",
    page: 1, size: 10,
  });

  // Try May
  await post(jwt, "/api/readings", {
    date_start: "2026-05-01T00:00:00",
    date_end:   "2026-05-31T23:59:59",
    page: 1, size: 5,
  });

  // Try broader range
  await post(jwt, "/api/readings", {
    date_start: "2026-01-01T00:00:00",
    date_end:   "2026-06-28T23:59:59",
    page: 1, size: 5,
  });
}

run().catch(console.error);
