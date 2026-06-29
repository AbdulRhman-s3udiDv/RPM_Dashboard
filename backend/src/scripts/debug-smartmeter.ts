import "dotenv/config";

const BASE = process.env.SMARTMETER_BASE_URL ?? "https://api.smartmeterrpm.com";
const KEY = process.env.SMARTMETER_API_KEY ?? "";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { "X-API-KEY": KEY } });
  const body = await res.json();
  console.log(`\n=== GET ${path} (${res.status}) ===`);
  console.log(JSON.stringify(body, null, 2).slice(0, 2000));
  return body;
}

async function run() {
  if (!KEY) { console.error("SMARTMETER_API_KEY not set"); process.exit(1); }

  // Check raw structure of each endpoint we use
  await get("/api/patients?size=5");
  await get("/api/patients/alerts/group?alert_status=unread&size=3");
  await get("/api/worklist/get-worklist?Status=OPEN&size=1");

  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const end = now.toISOString().slice(0, 10);
  await get(`/api/patients/billing?start_date=${start}&end_date=${end}`);
}

run().catch(console.error);
