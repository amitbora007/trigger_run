/**
 * SSRF (Server-Side Request Forgery) Defense Engine
 * Validates URLs, ports, IP ranges, obfuscated encodings, and DNS resolutions.
 */

export interface SSRFValidationResult {
  isValid: boolean;
  reason?: string;
  normalizedUrl?: string;
  targetIp?: string;
}

// Permitted outbound HTTP ports
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

// Forbidden IPv4 CIDR blocks represented as [networkInteger, maskInteger]
const FORBIDDEN_IPV4_CIDRS: Array<[number, number, string]> = [
  [ipToNumber('0.0.0.0'), cidrMask(8), 'Current Network (0.0.0.0/8)'],
  [ipToNumber('10.0.0.0'), cidrMask(8), 'Private RFC 1918 (10.0.0.0/8)'],
  [ipToNumber('100.64.0.0'), cidrMask(10), 'Carrier-Grade NAT (100.64.0.0/10)'],
  [ipToNumber('127.0.0.0'), cidrMask(8), 'Loopback (127.0.0.0/8)'],
  [ipToNumber('169.254.0.0'), cidrMask(16), 'Link-Local / Cloud Metadata (169.254.0.0/16)'],
  [ipToNumber('172.16.0.0'), cidrMask(12), 'Private RFC 1918 (172.16.0.0/12)'],
  [ipToNumber('192.0.0.0'), cidrMask(24), 'IETF Protocol (192.0.0.0/24)'],
  [ipToNumber('192.0.2.0'), cidrMask(24), 'Documentation TEST-NET-1 (192.0.2.0/24)'],
  [ipToNumber('192.88.99.0'), cidrMask(24), '6to4 Relay Anycast (192.88.99.0/24)'],
  [ipToNumber('192.168.0.0'), cidrMask(16), 'Private RFC 1918 (192.168.0.0/16)'],
  [ipToNumber('198.18.0.0'), cidrMask(15), 'Benchmark Testing (198.18.0.0/15)'],
  [ipToNumber('198.51.100.0'), cidrMask(24), 'Documentation TEST-NET-2 (198.51.100.0/24)'],
  [ipToNumber('203.0.113.0'), cidrMask(24), 'Documentation TEST-NET-3 (203.0.113.0/24)'],
  [ipToNumber('224.0.0.0'), cidrMask(4), 'Multicast (224.0.0.0/4)'],
  [ipToNumber('240.0.0.0'), cidrMask(4), 'Reserved (240.0.0.0/4)'],
  [ipToNumber('255.255.255.255'), cidrMask(32), 'Broadcast (255.255.255.255/32)'],
];

function cidrMask(prefixLength: number): number {
  if (prefixLength === 0) return 0;
  return (-1 << (32 - prefixLength)) >>> 0;
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

/**
 * Attempts to parse any representation of IPv4 (dotted decimal, hex, octal, integer).
 * Returns canonical dotted-decimal or null if invalid.
 */
export function parseAndNormalizeIPv4(input: string): string | null {
  const trimmed = input.trim().replace(/^\[|\]$/g, '');

  // 1. Single integer / dword representation (e.g. "2130706433" or "0x7f000001")
  if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
    const num = parseInt(trimmed, 16);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return numberToDottedDecimal(num >>> 0);
    }
  }

  if (/^\d+$/.test(trimmed) && !trimmed.includes('.')) {
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return numberToDottedDecimal(num >>> 0);
    }
  }

  // 2. Dotted parts (could be 1 to 4 parts with decimal, octal 0..., or hex 0x...)
  const parts = trimmed.split('.');
  if (parts.length >= 1 && parts.length <= 4) {
    const parsedParts: number[] = [];
    for (const part of parts) {
      if (!part) return null;
      let val: number;
      if (/^0x[0-9a-fA-F]+$/i.test(part)) {
        val = parseInt(part, 16);
      } else if (/^0[0-7]+$/.test(part)) {
        val = parseInt(part, 8);
      } else if (/^\d+$/.test(part)) {
        val = parseInt(part, 10);
      } else {
        return null;
      }
      if (isNaN(val) || val < 0) return null;
      parsedParts.push(val);
    }

    // Convert multi-part address into 32-bit integer
    let numericValue = 0;
    if (parsedParts.length === 4) {
      if (parsedParts.some((p) => p > 255)) return null;
      numericValue =
        ((parsedParts[0] << 24) | (parsedParts[1] << 16) | (parsedParts[2] << 8) | parsedParts[3]) >>> 0;
    } else if (parsedParts.length === 3) {
      // a.b.c -> a.b.0.0 + c
      if (parsedParts[0] > 255 || parsedParts[1] > 255 || parsedParts[2] > 0xffff) return null;
      numericValue = ((parsedParts[0] << 24) | (parsedParts[1] << 16) | parsedParts[2]) >>> 0;
    } else if (parsedParts.length === 2) {
      // a.b -> a.0.0.0 + b
      if (parsedParts[0] > 255 || parsedParts[1] > 0xffffff) return null;
      numericValue = ((parsedParts[0] << 24) | parsedParts[1]) >>> 0;
    } else if (parsedParts.length === 1) {
      if (parsedParts[0] > 0xffffffff) return null;
      numericValue = parsedParts[0] >>> 0;
    }

    return numberToDottedDecimal(numericValue);
  }

  return null;
}

function numberToDottedDecimal(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

/**
 * Validates whether an IPv4 address belongs to a forbidden private/local CIDR range.
 */
export function isForbiddenIPv4(ip: string): { forbidden: boolean; reason?: string } {
  const normalized = parseAndNormalizeIPv4(ip);
  if (!normalized) {
    return { forbidden: true, reason: 'Malformed IPv4 address' };
  }

  const num = ipToNumber(normalized);
  for (const [net, mask, reason] of FORBIDDEN_IPV4_CIDRS) {
    if ((num & mask) === (net & mask)) {
      return { forbidden: true, reason: `Matches blocked range: ${reason}` };
    }
  }

  return { forbidden: false };
}

/**
 * Validates whether an IPv6 address is loopback, ULA, link-local, multicast, or mapped IPv4.
 */
export function isForbiddenIPv6(ipv6: string): { forbidden: boolean; reason?: string } {
  const clean = ipv6.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // 1. Loopback and unspecified
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') {
    return { forbidden: true, reason: 'IPv6 loopback (::1)' };
  }
  if (clean === '::' || clean === '0:0:0:0:0:0:0:0') {
    return { forbidden: true, reason: 'IPv6 unspecified (::)' };
  }

  // 2. IPv4-mapped IPv6: ::ffff:127.0.0.1 or ::ffff:7f00:1
  const mappedMatch = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch) {
    return isForbiddenIPv4(mappedMatch[1]);
  }

  // 3. Unique Local Addresses (fc00::/7 -> fc00 to fdff)
  if (/^f[cd][0-9a-f]{2}:/i.test(clean)) {
    return { forbidden: true, reason: 'IPv6 Unique Local Address (fc00::/7)' };
  }

  // 4. Link-Local Addresses (fe80::/10 -> fe80 to febf)
  if (/^fe[89ab][0-9a-f]:/i.test(clean)) {
    return { forbidden: true, reason: 'IPv6 Link-Local Address (fe80::/10)' };
  }

  // 5. Multicast (ff00::/8)
  if (/^ff[0-9a-f]{2}:/i.test(clean)) {
    return { forbidden: true, reason: 'IPv6 Multicast Address (ff00::/8)' };
  }

  return { forbidden: false };
}

/**
 * Comprehensive SSRF validator for an endpoint URL.
 */
export function validateUrlForSSRF(rawUrl: string): SSRFValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, reason: 'URL must be a non-empty string' };
  }

  if (rawUrl.length > 2048) {
    return { isValid: false, reason: 'URL exceeds maximum length of 2048 characters' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { isValid: false, reason: 'Invalid URL format' };
  }

  // 1. Scheme Check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, reason: `Forbidden scheme '${parsed.protocol}'. Only http: and https: are allowed.` };
  }

  // 2. Port Check
  let port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    return {
      isValid: false,
      reason: `Forbidden port ${port}. Only standard web ports (80, 443, 8080, 8443) are allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Localhost / Common Names Check
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '0.0.0.0'
  ) {
    return { isValid: false, reason: `Target host '${hostname}' is a reserved local destination.` };
  }

  // 4. Check if hostname is an IPv4 or encoded IP
  const normalizedIPv4 = parseAndNormalizeIPv4(hostname);
  if (normalizedIPv4) {
    const check = isForbiddenIPv4(normalizedIPv4);
    if (check.forbidden) {
      return { isValid: false, reason: check.reason, targetIp: normalizedIPv4 };
    }
  }

  // 5. Check if hostname is an IPv6
  if (hostname.includes(':') || hostname.startsWith('[')) {
    const check = isForbiddenIPv6(hostname);
    if (check.forbidden) {
      return { isValid: false, reason: check.reason, targetIp: hostname };
    }
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
  };
}

/**
 * Performs DNS resolution check (if running in Deno runtime) or returns valid.
 */
export async function resolveAndCheckDns(hostname: string): Promise<{ isSafe: boolean; reason?: string }> {
  // If running in Deno runtime with Deno.resolveDns
  if (typeof (globalThis as any).Deno?.resolveDns === 'function') {
    try {
      const deno = (globalThis as any).Deno;
      // Check A records
      try {
        const aRecords: string[] = await deno.resolveDns(hostname, 'A');
        for (const ip of aRecords) {
          const check = isForbiddenIPv4(ip);
          if (check.forbidden) {
            return { isSafe: false, reason: `DNS resolved to forbidden IPv4: ${ip} (${check.reason})` };
          }
        }
      } catch (e: any) {
        // Domain might only have AAAA records
      }

      // Check AAAA records
      try {
        const aaaaRecords: string[] = await deno.resolveDns(hostname, 'AAAA');
        for (const ip of aaaaRecords) {
          const check = isForbiddenIPv6(ip);
          if (check.forbidden) {
            return { isSafe: false, reason: `DNS resolved to forbidden IPv6: ${ip} (${check.reason})` };
          }
        }
      } catch (e: any) {
        // Ignore if no AAAA records
      }
    } catch (err: any) {
      return { isSafe: false, reason: `DNS resolution failed: ${err.message}` };
    }
  }

  return { isSafe: true };
}
