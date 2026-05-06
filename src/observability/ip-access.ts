import { isIP } from "node:net";

const PRIVATE_CIDRS = [
  [0x7f000000, 8],   // 127.0.0.0/8
  [0x0a000000, 8],   // 10.0.0.0/8
  [0xac100000, 12],  // 172.16.0.0/12
  [0xc0a80000, 16],  // 192.168.0.0/16
] as const;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = ((n << 8) | v) >>> 0;
  }
  return n;
}

export function isLocalNetworkIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1") return true;
  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (!isIP(clean)) return false;
  const n = ipv4ToInt(clean);
  if (n === null) return false;
  return PRIVATE_CIDRS.some(
    ([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)),
  );
}

export function isAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return isLocalNetworkIp(ip);
  return allowlist.includes(ip);
}
