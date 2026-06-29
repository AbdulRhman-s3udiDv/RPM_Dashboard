import 'dotenv/config';
import crypto from 'crypto';

function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v !== -1) bits += v.toString(2).padStart(5, '0');
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
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  const code = (((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3]) % 1_000_000;
  return code.toString().padStart(6, '0');
}

async function main() {
  const otp = computeTOTP(process.env.TENOVI_TOTP_SECRET!);
  const res = await fetch('https://api2.tenovi.com/auth/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.tenovi.com' },
    body: JSON.stringify({
      username: process.env.TENOVI_USERNAME,
      password: process.env.TENOVI_PASSWORD,
      otp,
      otp_method: 'A',
      session_cookie: crypto.randomUUID(),
    }),
  });
  const body = await res.json() as any;
  if (!res.ok) { console.log('❌ Login failed:', res.status); process.exit(1); }
  const token = body.token;
  const hdrs = { Authorization: 'Token ' + token, Accept: 'application/json' };

  const f = await fetch('https://api2.tenovi.com/clients/rpmcares/facilities/', { headers: hdrs });
  const fdata = await f.json() as any[];

  console.log('Active (status=AC) patients per facility:\n');
  let total = 0;
  for (const fac of fdata) {
    const r = await fetch(
      `https://api2.tenovi.com/clients/rpmcares/rpm/facilities/${fac.id}/patients/?status=AC&page_size=1`,
      { headers: hdrs }
    );
    const d = await r.json() as any;
    if (d.count > 0) {
      console.log(`  ${fac.name.padEnd(45)} ${d.count}`);
      total += d.count;
    }
  }
  console.log(`\n  TOTAL active: ${total}`);
}

main().catch(console.error);
