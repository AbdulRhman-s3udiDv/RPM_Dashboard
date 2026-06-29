import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function run() {
  const { data: clinics } = await sb.from('clinics').select('name, smartmeter_api_key').order('name');
  const { data: cache } = await sb.from('dashboard_cache').select('smartmeter, tenovi, synced_at').eq('id', 1).single();

  const sm  = cache?.smartmeter as any;
  const ten = cache?.tenovi as any;
  const breakdown: { name: string; totalPatients: number; complianceRate: number; unreadAlerts: number }[] = sm?.clinicBreakdown ?? [];

  const dbNames    = new Set((clinics as any[]).filter((c: any) => c.smartmeter_api_key).map((c: any) => c.name));
  const cacheNames = new Set(breakdown.map(c => c.name));

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║               RPM Dashboard System Audit                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── Cache status ──────────────────────────────────────────────────────
  console.log('\n── CACHE STATUS ─────────────────────────────────────────────');
  console.log('  Last synced:      ', cache?.synced_at ?? '❌ never');
  console.log('  Tenovi patients:  ', ten?.totalPatients ?? 0, `(${ten?.totalRpmPatients ?? 0} RPM, ${ten?.totalRtmPatients ?? 0} RTM)`);
  console.log('  Tenovi facilities:', ten?.facilityBreakdown?.length ?? 0, 'with active patients');
  console.log('  Tenovi 99454:     ', (ten?.readingsCompliance ?? 0) + '% readings compliance');
  console.log('  Tenovi 99457:     ', (ten?.reviewCompliance ?? 0) + '% review compliance');
  console.log('  SM patients:      ', sm?.totalPatients ?? 0);
  console.log('  SM clinics cached:', breakdown.length);
  console.log('  SM unread alerts: ', sm?.unreadAlerts ?? 0);
  console.log('  SM 16-day:        ', (sm?.complianceRate ?? 0) + '%');
  console.log('  SM 20-min:        ', (sm?.compliance20min ?? 0) + '%');
  console.log('  SM billing ready: ', (sm?.billingReadiness ?? 0) + '%');

  // ── Clinic alignment ──────────────────────────────────────────────────
  console.log('\n── CLINIC ALIGNMENT (DB vs Cache) ───────────────────────────');
  const inDBnotCache  = [...dbNames].filter(n => !cacheNames.has(n));
  const inCachenotDB  = [...cacheNames].filter(n => !dbNames.has(n));
  const noKey         = (clinics as any[]).filter((c: any) => !c.smartmeter_api_key);

  if (inDBnotCache.length === 0 && inCachenotDB.length === 0) {
    console.log(`  ✅ All ${dbNames.size} clinics with keys are present in the cache`);
  } else {
    if (inDBnotCache.length) {
      console.log(`  ⚠️  ${inDBnotCache.length} clinic(s) have SM keys but returned no data from SmartMeter API:`);
      inDBnotCache.forEach(n => console.log(`     · ${n}`));
    }
    if (inCachenotDB.length) {
      console.log(`  ⚠️  ${inCachenotDB.length} clinic(s) in cache not found in DB (name mismatch?):`);
      inCachenotDB.forEach(n => console.log(`     · ${n}`));
    }
  }
  if (noKey.length) {
    console.log(`  ℹ️  ${noKey.length} clinic(s) have no SmartMeter key (excluded from sync):`);
    noKey.forEach((c: any) => console.log(`     · ${c.name}`));
  }

  // ── Per-clinic cache breakdown ────────────────────────────────────────
  console.log('\n── SM CLINIC BREAKDOWN (from cache) ─────────────────────────');
  console.log('  ' + 'Clinic'.padEnd(45) + 'Pts'.padEnd(7) + 'Comp%'.padEnd(8) + 'Alerts');
  breakdown
    .sort((a, b) => b.totalPatients - a.totalPatients)
    .forEach(c => {
      console.log('  ' + c.name.padEnd(45) + String(c.totalPatients).padEnd(7) + String(c.complianceRate + '%').padEnd(8) + c.unreadAlerts);
    });

  // ── Tenovi facility breakdown ─────────────────────────────────────────
  console.log('\n── TENOVI FACILITY BREAKDOWN (from cache) ───────────────────');
  const facilities = ten?.facilityBreakdown ?? [];
  if (facilities.length === 0) {
    console.log('  ⚠️  No facilities in cache — token collision or credentials issue');
  } else {
    console.log('  ' + 'Facility'.padEnd(45) + 'Total'.padEnd(7) + 'RPM'.padEnd(6) + 'RTM');
    facilities.forEach((f: any) => console.log('  ' + f.name.padEnd(45) + String(f.activePatients).padEnd(7) + String(f.rpmPatients).padEnd(6) + f.rtmPatients));
  }

  // ── Server health ─────────────────────────────────────────────────────
  console.log('\n── SERVER HEALTH ────────────────────────────────────────────');
  const health = await fetch('http://localhost:4000/health').then(r => r.json()).catch(() => null) as any;
  console.log('  HTTP server:    ', health?.ok ? '✅ online at localhost:4000' : '❌ offline');
  const procs = execSync('ps aux | grep "RPM_Dashboard/backend/src/index" | grep -v grep | wc -l').toString().trim();
  console.log('  Node processes: ', procs === '1' ? '✅ 1 (correct)' : `⚠️  ${procs} — only 1 should run`);

  // ── Summary of issues ─────────────────────────────────────────────────
  console.log('\n── ISSUES & RECOMMENDATIONS ─────────────────────────────────');
  const issues: string[] = [];
  if (!cache?.synced_at) issues.push('❌ Cache was never populated — run the server to trigger sync');
  if ((ten?.totalPatients ?? 0) === 0) issues.push('⚠️  Tenovi cache is empty — likely a token collision (run only ONE server process)');
  if (inDBnotCache.length) issues.push(`⚠️  ${inDBnotCache.length} clinic(s) in DB not returning SM data — check their API keys`);
  if (inCachenotDB.length) issues.push(`⚠️  ${inCachenotDB.length} clinic name(s) in cache don't match DB names`);
  if (noKey.length) issues.push(`ℹ️  ${noKey.length} clinic(s) missing SM key — use Clinics screen to add`);
  if (procs !== '1') issues.push(`⚠️  ${procs} server processes running — kill extras to prevent token collisions`);

  if (issues.length === 0) console.log('  ✅ Everything looks good');
  else issues.forEach(i => console.log(' ', i));
}

run().catch(console.error);
