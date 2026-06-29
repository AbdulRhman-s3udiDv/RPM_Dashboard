// Tiny seeded RNG so demo data renders identically across reloads.
let _seed = 42;
export function setSeed(n: number) { _seed = n; }
export function rand() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}
export function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
export function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]; }
export function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}