/**
 * Header sanitization, secret masking, and response filtering
 */

// Headers forbidden from user-defined outbound requests
export const FORBIDDEN_OUTBOUND_HEADERS = new Set([
  'host',
  'authorization',
  'cookie',
  'set-cookie',
  'connection',
  'upgrade',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-authenticate',
  'content-length',
]);

// Allowed headers in stored response telemetry
export const ALLOWED_RESPONSE_HEADERS = new Set([
  'content-type',
  'content-length',
  'server',
  'date',
  'etag',
  'cache-control',
  'last-modified',
  'x-response-time',
  'access-control-allow-origin',
  'vary',
]);

const SECRET_KEY_REGEX = /(auth|token|secret|key|password|credential|bearer|session|cookie)/i;

/**
 * Filters and sanitizes user-supplied custom headers for outgoing HTTP GET requests.
 */
export function sanitizeOutboundHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {
    'User-Agent': 'VigilAPI-Monitor/1.0 (Supabase Edge Function; +https://github.com/vigilapi/monitor)',
    'Accept': '*/*',
  };

  if (!headers || typeof headers !== 'object') {
    return sanitized;
  }

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.trim().toLowerCase();
    if (FORBIDDEN_OUTBOUND_HEADERS.has(lowerKey)) {
      continue;
    }
    if (lowerKey.startsWith('x-forwarded-') || lowerKey.startsWith('cf-')) {
      continue;
    }
    if (typeof value === 'string' && value.length <= 1024) {
      sanitized[key.trim()] = value.trim();
    }
  }

  return sanitized;
}

/**
 * Returns a masked representation of custom headers safe for persistence and frontend display.
 */
export function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};

  if (!headers || typeof headers !== 'object') {
    return redacted;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (SECRET_KEY_REGEX.test(key)) {
      redacted[key] = '***REDACTED***';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Extracts and filters inbound response headers against the safe-list.
 */
export function filterResponseHeaders(headers: Headers): Record<string, string> {
  const filtered: Record<string, string> = {};

  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (ALLOWED_RESPONSE_HEADERS.has(lowerKey)) {
      filtered[lowerKey] = value.slice(0, 512); // Bound individual header value length
    }
  });

  return filtered;
}

/**
 * Safely caps and truncates a response body string to a maximum byte length.
 */
export function truncateResponseBody(body: string, maxBytes = 32768): { text: string; isTruncated: boolean } {
  if (!body) {
    return { text: '', isTruncated: false };
  }

  const encoder = new TextEncoder();
  const encoded = encoder.encode(body);

  if (encoded.length <= maxBytes) {
    return { text: body, isTruncated: false };
  }

  // Truncate to maxBytes
  const sliced = encoded.subarray(0, maxBytes);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return {
    text: decoder.decode(sliced),
    isTruncated: true,
  };
}
