/// <reference lib="deno.ns" />
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  validateUrlForSSRF,
  parseAndNormalizeIPv4,
  isForbiddenIPv4,
} from '../../supabase/functions/_shared/ssrf.ts';
import {
  sanitizeOutboundHeaders,
  redactSensitiveHeaders,
  truncateResponseBody,
} from '../../supabase/functions/_shared/headers.ts';

Deno.test('Deno: SSRF blocks loopback 127.0.0.1 and localhost', () => {
  assertEquals(validateUrlForSSRF('http://127.0.0.1').isValid, false);
  assertEquals(validateUrlForSSRF('http://localhost:8080').isValid, false);
  assertEquals(validateUrlForSSRF('http://169.254.169.254/latest/meta-data/').isValid, false);
});

Deno.test('Deno: SSRF decodes and blocks hex and octal addresses', () => {
  assertEquals(parseAndNormalizeIPv4('0x7f000001'), '127.0.0.1');
  assertEquals(isForbiddenIPv4('127.0.0.1').forbidden, true);
});

Deno.test('Deno: SSRF permits public valid HTTPS URLs', () => {
  const res = validateUrlForSSRF('https://httpbin.org/get');
  assertEquals(res.isValid, true);
});

Deno.test('Deno: Header sanitization and secret masking', () => {
  const sanitized = sanitizeOutboundHeaders({
    'Host': 'untrusted.com',
    'Authorization': 'Bearer test',
    'X-App': 'Monitoring',
  });
  assertEquals(sanitized['Host'], undefined);
  assertEquals(sanitized['Authorization'], undefined);
  assertEquals(sanitized['X-App'], 'Monitoring');

  const redacted = redactSensitiveHeaders({ 'X-Api-Key': 'my-secret' });
  assertEquals(redacted['X-Api-Key'], '***REDACTED***');
});

Deno.test('Deno: Response truncation caps text to 32 KB', () => {
  const truncated = truncateResponseBody('B'.repeat(40000), 32768);
  assertEquals(truncated.isTruncated, true);
  assertEquals(new TextEncoder().encode(truncated.text).length <= 32768, true);
});
