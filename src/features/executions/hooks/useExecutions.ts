import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/features/auth/AuthContext';
import { updateLocalEndpointRun } from '@/features/endpoints/hooks/useEndpoints';
import type { EndpointExecution, MonitoredEndpoint, ExecutionResult } from '@/types';

// Mock executions fixture for evaluation / sandbox mode
const SEED_EXECUTIONS: EndpointExecution[] = [
  {
    id: 'x1000000-0000-0000-0000-000000000001',
    endpoint_id: 'e1000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000001',
    scheduled_at: new Date(Date.now() - 120000).toISOString(),
    started_at: new Date(Date.now() - 120000).toISOString(),
    completed_at: new Date(Date.now() - 119850).toISOString(),
    status_code: 200,
    response_time_ms: 150,
    success: true,
    error_category: null,
    sanitized_error_message: null,
    response_headers: {
      'content-type': 'application/json',
      'content-length': '42',
      'server': 'gunicorn/19.9.0',
      'date': new Date().toUTCString(),
    },
    response_body: JSON.stringify({ status: 'ok', authenticated: true, uptime_seconds: 142301 }),
    is_truncated: false,
    correlation_id: 'corr-001',
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'x1000000-0000-0000-0000-000000000002',
    endpoint_id: 'e1000000-0000-0000-0000-000000000002',
    user_id: '00000000-0000-0000-0000-000000000001',
    scheduled_at: new Date(Date.now() - 260000).toISOString(),
    started_at: new Date(Date.now() - 260000).toISOString(),
    completed_at: new Date(Date.now() - 258950).toISOString(),
    status_code: 200,
    response_time_ms: 1050,
    success: true,
    error_category: null,
    sanitized_error_message: null,
    response_headers: {
      'content-type': 'application/json',
      'server': 'gunicorn/19.9.0',
    },
    response_body: JSON.stringify({ message: 'delayed response', delay_seconds: 1 }),
    is_truncated: false,
    correlation_id: 'corr-002',
    created_at: new Date(Date.now() - 260000).toISOString(),
  },
  {
    id: 'x1000000-0000-0000-0000-000000000003',
    endpoint_id: 'e1000000-0000-0000-0000-000000000003',
    user_id: '00000000-0000-0000-0000-000000000001',
    scheduled_at: new Date(Date.now() - 3600000).toISOString(),
    started_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 3599600).toISOString(),
    status_code: 503,
    response_time_ms: 400,
    success: false,
    error_category: 'HTTP_ERROR',
    sanitized_error_message: 'HTTP status 503 Service Unavailable',
    response_headers: {
      'content-type': 'text/html; charset=utf-8',
      'server': 'nginx',
    },
    response_body: '<html><body>503 Service Temporarily Unavailable</body></html>',
    is_truncated: false,
    correlation_id: 'corr-003',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

let localExecutions = [...SEED_EXECUTIONS];

export interface ExecutionFilterOptions {
  endpointId?: string;
  status?: 'all' | 'success' | 'failure';
  limit?: number;
}

export function useExecutions(filters?: ExecutionFilterOptions) {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['executions', user?.id, filters],
    queryFn: async (): Promise<EndpointExecution[]> => {
      if (isDemoMode || !isSupabaseConfigured) {
        let filtered = [...localExecutions];
        if (filters?.endpointId) {
          filtered = filtered.filter((x) => x.endpoint_id === filters.endpointId);
        }
        if (filters?.status === 'success') {
          filtered = filtered.filter((x) => x.success);
        } else if (filters?.status === 'failure') {
          filtered = filtered.filter((x) => !x.success);
        }
        return filtered.slice(0, filters?.limit || 100);
      }

      let q = supabase
        .from('endpoint_executions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.endpointId) {
        q = q.eq('endpoint_id', filters.endpointId);
      }
      if (filters?.status === 'success') {
        q = q.eq('success', true);
      } else if (filters?.status === 'failure') {
        q = q.eq('success', false);
      }
      if (filters?.limit) {
        q = q.limit(filters.limit);
      } else {
        q = q.limit(100);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const triggerTestMutation = useMutation({
    mutationFn: async (endpoint: MonitoredEndpoint): Promise<ExecutionResult> => {
      const startTime = performance.now();
      const scheduledAt = new Date().toISOString();
      const startedAt = scheduledAt;
      const correlationId = `manual-${Date.now()}`;

      // Execute browser-side test or call Edge Function
      let statusCode: number | null = null;
      let success = false;
      let errorCategory: any = null;
      let sanitizedMessage: string | null = null;
      let responseBody = '';
      let isTruncated = false;
      const responseHeaders: Record<string, string> = {};

      try {
        const res = await fetch(endpoint.endpoint_url, {
          method: 'GET',
          signal: AbortSignal.timeout(endpoint.request_timeout_ms || 10000),
        });
        statusCode = res.status;
        success = res.ok;
        if (!success) {
          errorCategory = 'HTTP_ERROR';
          sanitizedMessage = `HTTP status ${res.status} ${res.statusText}`;
        }
        res.headers.forEach((v, k) => {
          responseHeaders[k] = v;
        });
        const text = await res.text();
        responseBody = text.slice(0, 32768);
        isTruncated = text.length > 32768;
      } catch (err: any) {
        success = false;
        if (err.name === 'TimeoutError') {
          errorCategory = 'TIMEOUT';
          sanitizedMessage = `Request timed out after ${endpoint.request_timeout_ms || 10000}ms`;
        } else if (err.name === 'TypeError') {
          errorCategory = 'CONNECTION_REFUSED';
          sanitizedMessage = 'Browser blocked request (CORS/Network error). Serverless background runner bypasses browser CORS.';
        } else {
          errorCategory = 'UNKNOWN';
          sanitizedMessage = err.message || 'Request failed';
        }
      }

      const completedAt = new Date().toISOString();
      const durationMs = Math.round(performance.now() - startTime);

      const record: EndpointExecution = {
        id: `x1000000-0000-0000-0000-${Date.now().toString().slice(-12)}`,
        endpoint_id: endpoint.id,
        user_id: user?.id || 'demo-user',
        scheduled_at: scheduledAt,
        started_at: startedAt,
        completed_at: completedAt,
        status_code: statusCode,
        response_time_ms: durationMs,
        success,
        error_category: errorCategory,
        sanitized_error_message: sanitizedMessage,
        response_headers: responseHeaders,
        response_body: responseBody,
        is_truncated: isTruncated,
        correlation_id: correlationId,
        created_at: completedAt,
      };

      const intervalSec = Math.max(300, endpoint.interval_seconds || 300);
      const nextRunAt = new Date(Date.now() + intervalSec * 1000).toISOString();

      if (isDemoMode || !isSupabaseConfigured) {
        localExecutions.unshift(record);
        updateLocalEndpointRun(endpoint.id, startedAt, nextRunAt);
      } else {
        let rpcSucceeded = false;
        try {
          const { error: rpcError } = await supabase.rpc('record_execution_and_reschedule', {
            p_endpoint_id: endpoint.id,
            p_user_id: user?.id,
            p_scheduled_at: scheduledAt,
            p_started_at: startedAt,
            p_completed_at: completedAt,
            p_status_code: statusCode,
            p_response_time_ms: durationMs,
            p_success: success,
            p_error_category: errorCategory,
            p_sanitized_error_message: sanitizedMessage,
            p_response_headers: responseHeaders,
            p_response_body: responseBody,
            p_is_truncated: isTruncated,
            p_correlation_id: correlationId,
          });

          if (!rpcError) {
            rpcSucceeded = true;
          } else {
            console.warn('RPC record_execution_and_reschedule failed:', rpcError);
          }
        } catch (e) {
          console.warn('RPC record_execution_and_reschedule call exception:', e);
        }

        if (!rpcSucceeded) {
          await supabase
            .from('monitored_endpoints')
            .update({
              last_run_at: startedAt,
              next_run_at: nextRunAt,
              lease_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', endpoint.id);

          try {
            await supabase.from('endpoint_executions').insert(record);
          } catch (e) {
            console.warn('Direct execution insert ignored:', e);
          }
        }
      }

      // Synchronously update TanStack Query cache for instant UI feedback
      queryClient.setQueryData(['endpoints', user?.id], (old: MonitoredEndpoint[] | undefined) => {
        if (!old) return old;
        return old.map((ep) =>
          ep.id === endpoint.id
            ? { ...ep, last_run_at: startedAt, next_run_at: nextRunAt, updated_at: startedAt }
            : ep
        );
      });

      return record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
  });

  return {
    executions: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    triggerTestRun: triggerTestMutation.mutateAsync,
    isTesting: triggerTestMutation.isPending,
  };
}
