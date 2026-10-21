import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/features/auth/AuthContext';
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
        errorCategory = err.name === 'TimeoutError' ? 'TIMEOUT' : 'UNKNOWN';
        sanitizedMessage = err.message || 'Request failed';
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

      if (isDemoMode || !isSupabaseConfigured) {
        localExecutions.unshift(record);
      } else {
        await supabase.from('endpoint_executions').insert(record);
      }

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
