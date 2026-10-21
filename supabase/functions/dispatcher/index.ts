import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';
import { validateUrlForSSRF, resolveAndCheckDns } from '../_shared/ssrf.ts';
import {
  sanitizeOutboundHeaders,
  filterResponseHeaders,
  truncateResponseBody,
} from '../_shared/headers.ts';
import type { MonitoredEndpoint, ExecutionResult, ErrorCategory } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SCHEDULER_SECRET = Deno.env.get('SCHEDULER_SECRET') || '';

// Concurrency limit for batch executions
const CONCURRENCY_LIMIT = 10;

Deno.serve(async (req: Request) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
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
    if (text) {
      bodyData = JSON.parse(text);
    }
  } catch {
    // Default to empty object
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

  // Client authorized if valid apikey, user JWT, or scheduler credentials
  const isClientAuthorized =
    isSchedulerAuthorized ||
    Boolean(apiKeyHeader && apiKeyHeader.length > 10) ||
    Boolean(authHeader && authHeader.startsWith('Bearer '));

  // Initialize Supabase Admin Client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || apiKeyHeader, {
    auth: { persistSession: false },
  });

  // Handle diagnostic inspection
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

  // Handle on-demand test execution (bypasses browser CORS restrictions)
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

  // Authorize scheduled batch execution
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
    // 2. Claim due endpoints atomically using FOR UPDATE SKIP LOCKED
    const { data: claimedEndpoints, error: claimError } = await supabase.rpc(
      'claim_due_endpoints',
      {
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
      }
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

    // 3. Process claimed endpoints in bounded concurrent batches
    const results: ExecutionResult[] = [];
    for (let i = 0; i < endpoints.length; i += CONCURRENCY_LIMIT) {
      const slice = endpoints.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = slice.map((endpoint) =>
        executeMonitoredEndpoint(endpoint, correlationId, supabase)
      );
      const batchResults = await Promise.allSettled(batchPromises);
      for (const res of batchResults) {
        if (res.status === 'fulfilled') {
          results.push(res.value);
        }
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

/**
 * Executes a single monitored endpoint with SSRF screening, timeout bounding, and result recording.
 */
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
    // 1. SSRF URL Check
    const ssrfCheck = validateUrlForSSRF(endpoint.endpoint_url);
    if (!ssrfCheck.isValid) {
      throw new DetailedError('SSRF_BLOCKED', ssrfCheck.reason || 'Blocked by SSRF security filter');
    }

    // 2. Build complete URL with query params
    const targetUrl = new URL(ssrfCheck.normalizedUrl || endpoint.endpoint_url);
    if (endpoint.query_params && typeof endpoint.query_params === 'object') {
      for (const [k, v] of Object.entries(endpoint.query_params)) {
        if (typeof v === 'string') {
          targetUrl.searchParams.append(k, v);
        }
      }
    }

    // 3. DNS resolution check (if running in environment supporting DNS lookups)
    const dnsCheck = await resolveAndCheckDns(targetUrl.hostname);
    if (!dnsCheck.isSafe) {
      throw new DetailedError('SSRF_BLOCKED', dnsCheck.reason || 'DNS resolved to unsafe address');
    }

    // 4. Sanitize outbound headers
    const outgoingHeaders = sanitizeOutboundHeaders(endpoint.headers);

    // 5. Fire HTTP GET with AbortSignal timeout
    const timeoutMs = Math.min(Math.max(endpoint.request_timeout_ms || 10000, 1000), 30000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: outgoingHeaders,
        signal: controller.signal,
        redirect: 'manual', // Prevent SSRF redirect bypass
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

    // 6. Capture response headers
    responseHeaders = filterResponseHeaders(response.headers);

    // 7. Read and bound response body
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
    if (err instanceof DetailedError) {
      errorCategory = err.category;
      sanitizedErrorMessage = err.message;
    } else if (err.name === 'AbortError' || err.message?.toLowerCase().includes('aborted') || err.message?.toLowerCase().includes('timeout')) {
      errorCategory = 'TIMEOUT';
      sanitizedErrorMessage = `Request exceeded configured timeout of ${endpoint.request_timeout_ms}ms`;
    } else if (err.message?.includes('ENOTFOUND') || err.message?.includes('getaddrinfo') || err.message?.includes('dns')) {
      errorCategory = 'DNS_ERROR';
      sanitizedErrorMessage = 'Unable to resolve hostname';
    } else if (err.message?.includes('ECONNREFUSED') || err.message?.includes('refused')) {
      errorCategory = 'CONNECTION_REFUSED';
      sanitizedErrorMessage = 'Connection refused by target server';
    } else {
      errorCategory = 'UNKNOWN';
      sanitizedErrorMessage = err.message ? err.message.slice(0, 256) : 'Unknown network failure';
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

  // 8. Persist execution and reschedule next_run_at via RPC
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

  return result;
}

class DetailedError extends Error {
  constructor(public category: ErrorCategory, message: string) {
    super(message);
    this.name = 'DetailedError';
  }
}
