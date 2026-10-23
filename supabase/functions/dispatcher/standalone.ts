import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

// ============================================================================
// Types
// ============================================================================
export type ErrorCategory =
  | 'DNS_ERROR'
  | 'TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'HTTP_ERROR'
  | 'SSRF_BLOCKED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNKNOWN';

export interface MonitoredEndpoint {
  id: string;
  user_id: string;
  name: string;
  endpoint_url: string;
  method: string;
  interval_seconds: number;
  request_timeout_ms: number;
  query_params: Record<string, string>;
  headers: Record<string, string>;
  is_enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  lease_expires_at: string | null;
  notify_on_failure?: boolean;
  notification_email?: string | null;
  last_alert_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionResult {
  endpoint_id: string;
  user_id: string;
  scheduled_at: string;
  started_at: string;
  completed_at: string;
  status_code: number | null;
  response_time_ms: number;
  success: boolean;
  error_category: ErrorCategory | null;
  sanitized_error_message: string | null;
  response_headers: Record<string, string>;
  response_body: string | null;
  is_truncated: boolean;
  correlation_id: string;
}

// ============================================================================
// SSRF Defense Engine
// ============================================================================
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

function cidrMask(prefixLength: number): number {
  if (prefixLength === 0) return 0;
  return (-1 << (32 - prefixLength)) >>> 0;
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

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

export function parseAndNormalizeIPv4(input: string): string | null {
  const trimmed = input.trim().replace(/^\[|\]$/g, '');

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

    let numericValue = 0;
    if (parsedParts.length === 4) {
      if (parsedParts.some((p) => p > 255)) return null;
      numericValue =
        ((parsedParts[0] << 24) | (parsedParts[1] << 16) | (parsedParts[2] << 8) | parsedParts[3]) >>> 0;
    } else if (parsedParts.length === 3) {
      if (parsedParts[0] > 255 || parsedParts[1] > 255 || parsedParts[2] > 0xffff) return null;
      numericValue = ((parsedParts[0] << 24) | (parsedParts[1] << 16) | parsedParts[2]) >>> 0;
    } else if (parsedParts.length === 2) {
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

export function isForbiddenIPv4(ip: string): { forbidden: boolean; reason?: string } {
  const normalized = parseAndNormalizeIPv4(ip);
  if (!normalized) return { forbidden: true, reason: 'Malformed IPv4 address' };

  const num = ipToNumber(normalized);
  for (const [net, mask, reason] of FORBIDDEN_IPV4_CIDRS) {
    if ((num & mask) === (net & mask)) {
      return { forbidden: true, reason: `Matches blocked range: ${reason}` };
    }
  }

  return { forbidden: false };
}

export function isForbiddenIPv6(ipv6: string): { forbidden: boolean; reason?: string } {
  const clean = ipv6.toLowerCase().trim().replace(/^\[|\]$/g, '');

  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return { forbidden: true, reason: 'IPv6 loopback (::1)' };
  if (clean === '::' || clean === '0:0:0:0:0:0:0:0') return { forbidden: true, reason: 'IPv6 unspecified (::)' };

  const mappedMatch = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch) return isForbiddenIPv4(mappedMatch[1]);

  if (/^f[cd][0-9a-f]{2}:/i.test(clean)) return { forbidden: true, reason: 'IPv6 Unique Local Address (fc00::/7)' };
  if (/^fe[89ab][0-9a-f]:/i.test(clean)) return { forbidden: true, reason: 'IPv6 Link-Local Address (fe80::/10)' };
  if (/^ff[0-9a-f]{2}:/i.test(clean)) return { forbidden: true, reason: 'IPv6 Multicast Address (ff00::/8)' };

  return { forbidden: false };
}

export function validateUrlForSSRF(rawUrl: string): { isValid: boolean; reason?: string; normalizedUrl?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') return { isValid: false, reason: 'URL must be a non-empty string' };
  if (rawUrl.length > 2048) return { isValid: false, reason: 'URL exceeds maximum length of 2048 characters' };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { isValid: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, reason: `Forbidden scheme '${parsed.protocol}'. Only http: and https: are allowed.` };
  }

  let port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    return { isValid: false, reason: `Forbidden port ${port}. Only standard web ports (80, 443, 8080, 8443) are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '0.0.0.0'
  ) {
    return { isValid: false, reason: `Target host '${hostname}' is a reserved local destination.` };
  }

  const normalizedIPv4 = parseAndNormalizeIPv4(hostname);
  if (normalizedIPv4) {
    const check = isForbiddenIPv4(normalizedIPv4);
    if (check.forbidden) return { isValid: false, reason: check.reason };
  }

  if (hostname.includes(':') || hostname.startsWith('[')) {
    const check = isForbiddenIPv6(hostname);
    if (check.forbidden) return { isValid: false, reason: check.reason };
  }

  return { isValid: true, normalizedUrl: parsed.toString() };
}

// ============================================================================
// Header Sanitization & Body Truncation
// ============================================================================
const FORBIDDEN_OUTBOUND_HEADERS = new Set([
  'host', 'authorization', 'cookie', 'set-cookie', 'connection', 'upgrade',
  'keep-alive', 'transfer-encoding', 'te', 'trailer', 'proxy-authorization',
  'proxy-authenticate', 'content-length'
]);

const ALLOWED_RESPONSE_HEADERS = new Set([
  'content-type', 'content-length', 'server', 'date', 'etag', 'cache-control',
  'last-modified', 'x-response-time', 'access-control-allow-origin', 'vary'
]);

export function sanitizeOutboundHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {
    'User-Agent': 'VigilAPI-Monitor/1.0 (Supabase Edge Function; +https://github.com/vigilapi/monitor)',
    'Accept': '*/*',
  };

  if (!headers || typeof headers !== 'object') return sanitized;

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.trim().toLowerCase();
    if (FORBIDDEN_OUTBOUND_HEADERS.has(lowerKey)) continue;
    if (lowerKey.startsWith('x-forwarded-') || lowerKey.startsWith('cf-')) continue;
    if (typeof value === 'string' && value.length <= 1024) sanitized[key.trim()] = value.trim();
  }

  return sanitized;
}

export function filterResponseHeaders(headers: Headers): Record<string, string> {
  const filtered: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (ALLOWED_RESPONSE_HEADERS.has(lowerKey)) {
      filtered[lowerKey] = value.slice(0, 512);
    }
  });
  return filtered;
}

export function truncateResponseBody(body: string, maxBytes = 32768): { text: string; isTruncated: boolean } {
  if (!body) return { text: '', isTruncated: false };
  const encoded = new TextEncoder().encode(body);
  if (encoded.length <= maxBytes) return { text: body, isTruncated: false };
  return {
    text: new TextDecoder('utf-8', { fatal: false }).decode(encoded.subarray(0, maxBytes)),
    isTruncated: true,
  };
}

// ============================================================================
// Main Dispatcher HTTP Handler
// ============================================================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SCHEDULER_SECRET = Deno.env.get('SCHEDULER_SECRET') || '';
const CONCURRENCY_LIMIT = 10;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Scheduler-Secret, apikey, x-client-info',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const correlationId = crypto.randomUUID();
  const startTime = performance.now();

  let bodyData: any = {};
  try {
    const text = await req.text();
    if (text) bodyData = JSON.parse(text);
  } catch {
    // Default
  }

  const schedulerHeader = req.headers.get('X-Scheduler-Secret');
  const authHeader = req.headers.get('Authorization') || '';
  const apiKeyHeader = req.headers.get('apikey') || '';
  const serviceKeyBearer = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

  const isSchedulerAuthorized =
    (SCHEDULER_SECRET && schedulerHeader === SCHEDULER_SECRET) ||
    (SUPABASE_SERVICE_ROLE_KEY && authHeader === serviceKeyBearer) ||
    (!SCHEDULER_SECRET);

  const isTestEndpointAction = bodyData?.action === 'test_endpoint' || bodyData?.action === 'test';
  const isDiagnosticAction = bodyData?.action === 'diagnostic';

  const isClientAuthorized =
    isSchedulerAuthorized ||
    Boolean(apiKeyHeader && apiKeyHeader.length > 10) ||
    Boolean(authHeader && authHeader.startsWith('Bearer '));

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || apiKeyHeader, {
    auth: { persistSession: false },
  });

  if (isDiagnosticAction) {
    const { data: watchdog } = await supabase.from('v_system_health_watchdog').select('*').maybeSingle();
    const { data: endpoints } = await supabase.from('monitored_endpoints').select('*');
    const { data: executions } = await supabase.from('endpoint_executions').select('*').order('created_at', { ascending: false }).limit(10);

    return new Response(JSON.stringify({
      now: new Date().toISOString(),
      hasSchedulerSecret: Boolean(SCHEDULER_SECRET),
      watchdog,
      endpoints,
      executions,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (isTestEndpointAction) {
    if (!isClientAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized test invocation' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const targetEndpoint: MonitoredEndpoint = bodyData.endpoint;
    if (!targetEndpoint || !targetEndpoint.endpoint_url) {
      return new Response(JSON.stringify({ error: 'Missing endpoint or endpoint_url in request body' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const testResult = await executeMonitoredEndpoint(targetEndpoint, correlationId, supabase);
    return new Response(
      JSON.stringify({
        success: true,
        result: testResult,
        correlation_id: correlationId,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (!isSchedulerAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized scheduler invocation' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const batchSize = Math.min(Math.max(bodyData.batch_size || 50, 1), 100);
  const leaseSeconds = Math.min(Math.max(bodyData.lease_seconds || 120, 30), 300);

  try {
    const { data: claimedEndpoints, error: claimError } = await supabase.rpc(
      'claim_due_endpoints',
      { p_batch_size: batchSize, p_lease_seconds: leaseSeconds }
    );

    if (claimError) {
      console.error(`[${correlationId}] claim_due_endpoints error:`, claimError);
      return new Response(JSON.stringify({ error: 'Failed to claim endpoints', details: claimError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const endpoints: MonitoredEndpoint[] = claimedEndpoints || [];
    console.log(`[${correlationId}] Claimed ${endpoints.length} due endpoints.`);

    if (endpoints.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          claimed_count: 0,
          completed_count: 0,
          duration_ms: Math.round(performance.now() - startTime),
          correlation_id: correlationId,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results: ExecutionResult[] = [];
    for (let i = 0; i < endpoints.length; i += CONCURRENCY_LIMIT) {
      const slice = endpoints.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = slice.map((endpoint) =>
        executeMonitoredEndpoint(endpoint, correlationId, supabase)
      );
      const batchResults = await Promise.allSettled(batchPromises);
      for (const res of batchResults) {
        if (res.status === 'fulfilled') results.push(res.value);
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    return new Response(
      JSON.stringify({
        success: true,
        claimed_count: endpoints.length,
        completed_count: results.length,
        duration_ms: durationMs,
        correlation_id: correlationId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error(`[${correlationId}] Unexpected dispatcher error:`, err);
    return new Response(
      JSON.stringify({ error: 'Internal dispatcher failure', details: err.message, correlation_id: correlationId }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function executeMonitoredEndpoint(
  endpoint: MonitoredEndpoint,
  correlationId: string,
  supabase: any
): Promise<ExecutionResult> {
  const scheduledAt = endpoint.next_run_at || new Date().toISOString();
  const startedAt = new Date().toISOString();
  const startPerf = performance.now();

  let statusCode: number | null = null;
  let success = false;
  let errorCategory: ErrorCategory | null = null;
  let sanitizedErrorMessage: string | null = null;
  let responseHeaders: Record<string, string> = {};
  let responseBody: string | null = null;
  let isTruncated = false;

  try {
    const ssrfCheck = validateUrlForSSRF(endpoint.endpoint_url);
    if (!ssrfCheck.isValid) {
      throw new Error(`SSRF_BLOCKED: ${ssrfCheck.reason}`);
    }

    const targetUrl = new URL(ssrfCheck.normalizedUrl || endpoint.endpoint_url);
    if (endpoint.query_params && typeof endpoint.query_params === 'object') {
      for (const [k, v] of Object.entries(endpoint.query_params)) {
        if (typeof v === 'string') targetUrl.searchParams.append(k, v);
      }
    }

    const outgoingHeaders = sanitizeOutboundHeaders(endpoint.headers);
    const timeoutMs = Math.min(Math.max(endpoint.request_timeout_ms || 10000, 1000), 30000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: outgoingHeaders,
        signal: controller.signal,
        redirect: 'manual',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    statusCode = response.status;
    success = response.status >= 200 && response.status < 400;
    if (!success) {
      errorCategory = 'HTTP_ERROR';
      sanitizedErrorMessage = `HTTP status ${response.status} ${response.statusText || 'Error'}`;
    }

    responseHeaders = filterResponseHeaders(response.headers);
    const contentType = response.headers.get('content-type') || '';
    if (
      contentType.includes('image/') ||
      contentType.includes('audio/') ||
      contentType.includes('video/') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/pdf')
    ) {
      responseBody = `[Binary content omitted: ${contentType}]`;
      isTruncated = false;
    } else {
      const rawText = await response.text();
      const truncated = truncateResponseBody(rawText, 32768);
      responseBody = truncated.text;
      isTruncated = truncated.isTruncated;
    }
  } catch (err: any) {
    success = false;
    const msg = err.message || '';
    if (msg.startsWith('SSRF_BLOCKED:')) {
      errorCategory = 'SSRF_BLOCKED';
      sanitizedErrorMessage = msg.replace('SSRF_BLOCKED: ', '');
    } else if (err.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout')) {
      errorCategory = 'TIMEOUT';
      sanitizedErrorMessage = `Request exceeded configured timeout of ${endpoint.request_timeout_ms}ms`;
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo') || msg.includes('dns')) {
      errorCategory = 'DNS_ERROR';
      sanitizedErrorMessage = 'Unable to resolve hostname';
    } else if (msg.includes('ECONNREFUSED') || msg.includes('refused')) {
      errorCategory = 'CONNECTION_REFUSED';
      sanitizedErrorMessage = 'Connection refused by target server';
    } else {
      errorCategory = 'UNKNOWN';
      sanitizedErrorMessage = msg.slice(0, 256) || 'Unknown network failure';
    }
  }

  const completedAt = new Date().toISOString();
  const responseTimeMs = Math.round(performance.now() - startPerf);

  const result: ExecutionResult = {
    endpoint_id: endpoint.id,
    user_id: endpoint.user_id,
    scheduled_at: scheduledAt,
    started_at: startedAt,
    completed_at: completedAt,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    success,
    error_category: errorCategory,
    sanitized_error_message: sanitizedErrorMessage,
    response_headers: responseHeaders,
    response_body: responseBody,
    is_truncated: isTruncated,
    correlation_id: correlationId,
  };

  const isValidUuid = (id: string | null | undefined) =>
    Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

  if (isValidUuid(result.endpoint_id) && isValidUuid(result.user_id)) {
    try {
      await supabase.rpc('record_execution_and_reschedule', {
        p_endpoint_id: result.endpoint_id,
        p_user_id: result.user_id,
        p_scheduled_at: result.scheduled_at,
        p_started_at: result.started_at,
        p_completed_at: result.completed_at,
        p_status_code: result.status_code,
        p_response_time_ms: result.response_time_ms,
        p_success: result.success,
        p_error_category: result.error_category,
        p_sanitized_error_message: result.sanitized_error_message,
        p_response_headers: result.response_headers,
        p_response_body: result.response_body,
        p_is_truncated: result.is_truncated,
        p_correlation_id: result.correlation_id,
      });
    } catch (dbErr: any) {
      console.error(`[${correlationId}] Failed to record execution for endpoint ${endpoint.id}:`, dbErr);
    }
  }

  // 9. Automated Incident Alert Notification via Resend (with 15-minute cooldown)
  if (!result.success && endpoint.notify_on_failure !== false && isValidUuid(result.endpoint_id)) {
    try {
      await handleFailureNotification(endpoint, result, supabase, correlationId);
    } catch (notifyErr: any) {
      console.error(`[${correlationId}] Failed to process alert notification for endpoint ${endpoint.id}:`, notifyErr);
    }
  }

  return result;
}

const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes alert cooldown

async function handleFailureNotification(
  endpoint: MonitoredEndpoint,
  result: ExecutionResult,
  supabase: any,
  correlationId: string
) {
  // Check cooldown: avoid alert storm if alerted recently
  if (endpoint.last_alert_sent_at) {
    const elapsedMs = Date.now() - new Date(endpoint.last_alert_sent_at).getTime();
    if (elapsedMs < ALERT_COOLDOWN_MS) {
      console.log(
        `[${correlationId}] Skipping alert for ${endpoint.name}: cooldown active (${Math.round(
          (ALERT_COOLDOWN_MS - elapsedMs) / 1000
        )}s remaining)`
      );
      return;
    }
  }

  // Resolve recipient email: custom endpoint notification_email or fallback to user profile / auth
  let recipientEmail = endpoint.notification_email?.trim();
  if (!recipientEmail && endpoint.user_id) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(endpoint.user_id);
      recipientEmail = userData?.user?.email;
    } catch {
      // Ignored: will log if email cannot be resolved
    }
  }

  if (!recipientEmail) {
    console.log(`[${correlationId}] No notification email configured or resolved for endpoint ${endpoint.id}`);
    return;
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.log(`[${correlationId}] RESEND_API_KEY is not set. Alert notification skipped.`);
    return;
  }

  const emailSubject = `🚨 [INCIDENT] ${endpoint.name} is Failing`;
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VigilAPI Incident Alert</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F9FAFB;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1F2937; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
    <div style="padding: 24px 28px; background-color: #1F2937; border-bottom: 1px solid #374151;">
      <h2 style="margin: 0; color: #EF4444; font-size: 20px; font-weight: 700;">
        ⚠️ VigilAPI Incident Alert
      </h2>
      <p style="margin: 6px 0 0 0; color: #9CA3AF; font-size: 14px;">
        Scheduled health check failure detected for your monitored endpoint.
      </p>
    </div>
    
    <div style="padding: 28px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <tr>
          <td style="padding: 10px 0; color: #9CA3AF; border-bottom: 1px solid #1F2937; width: 140px;">Endpoint</td>
          <td style="padding: 10px 0; color: #F9FAFB; font-weight: 600; border-bottom: 1px solid #1F2937;">${endpoint.name}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #9CA3AF; border-bottom: 1px solid #1F2937;">Target URL</td>
          <td style="padding: 10px 0; color: #60A5FA; font-family: monospace; font-size: 13px; border-bottom: 1px solid #1F2937; word-break: break-all;">${endpoint.endpoint_url}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #9CA3AF; border-bottom: 1px solid #1F2937;">Status Code</td>
          <td style="padding: 10px 0; color: #EF4444; font-weight: 700; border-bottom: 1px solid #1F2937;">${result.status_code !== null ? result.status_code : 'Connection Failed'}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #9CA3AF; border-bottom: 1px solid #1F2937;">Error Category</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #1F2937;">
            <span style="background-color: rgba(239, 68, 68, 0.2); color: #F87171; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              ${result.error_category || 'UNKNOWN'}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #9CA3AF; border-bottom: 1px solid #1F2937;">Diagnostic</td>
          <td style="padding: 10px 0; color: #EF4444; font-family: monospace; font-size: 13px; border-bottom: 1px solid #1F2937; word-break: break-word;">
            ${result.sanitized_error_message || 'Non-2xx response received'}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #9CA3AF;">Occurred At</td>
          <td style="padding: 10px 0; color: #D1D5DB;">${new Date(result.started_at).toUTCString()}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://amitbora007.github.io/vigilapi/#/executions" style="display: inline-block; background-color: #10B981; color: #FFFFFF; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
          View Incident in VigilAPI Dashboard
        </a>
      </div>

      <p style="margin-top: 28px; color: #6B7280; font-size: 12px; text-align: center; border-top: 1px solid #1F2937; padding-top: 16px;">
        VigilAPI Autonomous Cloud API Watchdog • Automated alert throttled to 1 per 15 minutes.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const senderEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'VigilAPI Alerts <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: senderEmail,
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[${correlationId}] Resend API returned error ${res.status}:`, errorText);
    return;
  }

  const sendResult = await res.json();
  console.log(`[${correlationId}] Incident alert sent to ${recipientEmail} via Resend (ID: ${sendResult.id})`);

  // Update last_alert_sent_at in monitored_endpoints
  await supabase
    .from('monitored_endpoints')
    .update({ last_alert_sent_at: new Date().toISOString() })
    .eq('id', endpoint.id);
}
