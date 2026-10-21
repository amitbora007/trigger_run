import { describe, it, expect } from 'vitest';
import {
  sanitizeOutboundHeaders,
  redactSensitiveHeaders,
  filterResponseHeaders,
  truncateResponseBody,
  FORBIDDEN_OUTBOUND_HEADERS,
} from '../../supabase/functions/_shared/headers';

describe('Header Sanitization & Secret Redaction', () => {
  it('strips forbidden hop-by-hop and auth headers from outgoing requests', () => {
    expect(FORBIDDEN_OUTBOUND_HEADERS.has('host')).toBe(true);
    expect(FORBIDDEN_OUTBOUND_HEADERS.has('authorization')).toBe(true);

    const maliciousHeaders = {
      'Host': 'internal.attacker.com',
      'Authorization': 'Bearer evil-token',
      'Cookie': 'session=secret',
      'Connection': 'upgrade',
      'Transfer-Encoding': 'chunked',
      'X-Forwarded-For': '127.0.0.1',
      'X-Custom-Safe-Header': 'ApplicationMetric',
    };

    const sanitized = sanitizeOutboundHeaders(maliciousHeaders);

    expect(sanitized['Host']).toBeUndefined();
    expect(sanitized['Authorization']).toBeUndefined();
    expect(sanitized['Cookie']).toBeUndefined();
    expect(sanitized['Connection']).toBeUndefined();
    expect(sanitized['Transfer-Encoding']).toBeUndefined();
    expect(sanitized['X-Forwarded-For']).toBeUndefined();
    expect(sanitized['X-Custom-Safe-Header']).toBe('ApplicationMetric');
    expect(sanitized['User-Agent']).toContain('VigilAPI-Monitor');
  });

  it('redacts sensitive secret values for logging and frontend rendering', () => {
    const inputHeaders = {
      'X-Api-Key': 'super-secret-production-key',
      'Authorization-Token': 'jwt-token-12345',
      'Client-Secret': 'shhhh',
      'X-App-Name': 'PublicWebStore',
    };

    const redacted = redactSensitiveHeaders(inputHeaders);

    expect(redacted['X-Api-Key']).toBe('***REDACTED***');
    expect(redacted['Authorization-Token']).toBe('***REDACTED***');
    expect(redacted['Client-Secret']).toBe('***REDACTED***');
    expect(redacted['X-App-Name']).toBe('PublicWebStore');
  });

  it('filters inbound response headers against safe allowlist', () => {
    const rawHeaders = new Headers({
      'Content-Type': 'application/json',
      'Content-Length': '128',
      'Server': 'cloudflare',
      'Date': 'Wed, 21 Oct 2026 06:00:00 GMT',
      'Set-Cookie': 'session=untrusted; HttpOnly; Secure',
      'X-Internal-Cluster': 'node-42.internal',
    });

    const filtered = filterResponseHeaders(rawHeaders);

    expect(filtered['content-type']).toBe('application/json');
    expect(filtered['content-length']).toBe('128');
    expect(filtered['server']).toBe('cloudflare');
    expect(filtered['date']).toBe('Wed, 21 Oct 2026 06:00:00 GMT');
    expect(filtered['set-cookie']).toBeUndefined();
    expect(filtered['x-internal-cluster']).toBeUndefined();
  });

  it('caps response bodies to 32 KB and flags truncation', () => {
    const smallPayload = JSON.stringify({ hello: 'world' });
    const smallResult = truncateResponseBody(smallPayload, 32768);
    expect(smallResult.isTruncated).toBe(false);
    expect(smallResult.text).toBe(smallPayload);

    // Large payload > 32KB
    const largePayload = 'A'.repeat(50000);
    const largeResult = truncateResponseBody(largePayload, 32768);
    expect(largeResult.isTruncated).toBe(true);
    expect(new TextEncoder().encode(largeResult.text).length).toBeLessThanOrEqual(32768);
  });
});
