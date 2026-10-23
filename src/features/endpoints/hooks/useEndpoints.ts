import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { MonitoredEndpoint, EndpointFormData } from '@/types';

// Mock initial data for evaluation / sandbox mode
const SEED_ENDPOINTS: MonitoredEndpoint[] = [
  {
    id: 'e1000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Production Auth Gateway Health',
    endpoint_url: 'https://httpbin.org/status/200',
    method: 'GET',
    interval_seconds: 300,
    request_timeout_ms: 5000,
    query_params: { env: 'production', v: '2' },
    headers: { 'Accept': 'application/json' },
    is_enabled: true,
    notify_on_failure: true,
    notification_email: null,
    last_alert_sent_at: null,
    next_run_at: new Date(Date.now() + 180000).toISOString(),
    last_run_at: new Date(Date.now() - 120000).toISOString(),
    lease_expires_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'e1000000-0000-0000-0000-000000000002',
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Payments Webhook Listener',
    endpoint_url: 'https://httpbin.org/delay/1',
    method: 'GET',
    interval_seconds: 600,
    request_timeout_ms: 10000,
    query_params: {},
    headers: { 'X-Service': 'Payments' },
    is_enabled: true,
    notify_on_failure: true,
    notification_email: 'ops-team@company.internal',
    last_alert_sent_at: null,
    next_run_at: new Date(Date.now() + 340000).toISOString(),
    last_run_at: new Date(Date.now() - 260000).toISOString(),
    lease_expires_at: null,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 260000).toISOString(),
  },
  {
    id: 'e1000000-0000-0000-0000-000000000003',
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Legacy Billing Microservice',
    endpoint_url: 'https://httpbin.org/status/503',
    method: 'GET',
    interval_seconds: 900,
    request_timeout_ms: 10000,
    query_params: {},
    headers: {},
    is_enabled: false,
    notify_on_failure: false,
    notification_email: null,
    last_alert_sent_at: null,
    next_run_at: new Date(Date.now() + 720000).toISOString(),
    last_run_at: new Date(Date.now() - 3600000).toISOString(),
    lease_expires_at: null,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

// In-memory store for evaluation mode
let localEndpoints = [...SEED_ENDPOINTS];

export function updateLocalEndpointRun(endpointId: string, startedAt: string, nextRunAt: string) {
  localEndpoints = localEndpoints.map((ep) =>
    ep.id === endpointId ? { ...ep, last_run_at: startedAt, next_run_at: nextRunAt, updated_at: startedAt } : ep
  );
}

export function useEndpoints() {
  const { user, isDemoMode } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['endpoints', user?.id],
    queryFn: async (): Promise<MonitoredEndpoint[]> => {
      if (isDemoMode || !isSupabaseConfigured) {
        return [...localEndpoints];
      }

      const { data, error } = await supabase
        .from('monitored_endpoints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000, // Poll every 15s when active on screen
  });

  const createMutation = useMutation({
    mutationFn: async (formData: EndpointFormData) => {
      const queryParamsObj: Record<string, string> = {};
      formData.query_params.forEach(({ key, value }) => {
        if (key.trim()) queryParamsObj[key.trim()] = value;
      });

      const headersObj: Record<string, string> = {};
      formData.headers.forEach(({ key, value }) => {
        if (key.trim()) headersObj[key.trim()] = value;
      });

      const payload = {
        name: formData.name.trim(),
        endpoint_url: formData.endpoint_url.trim(),
        method: 'GET' as const,
        interval_seconds: formData.interval_seconds,
        request_timeout_ms: formData.request_timeout_ms,
        query_params: queryParamsObj,
        headers: headersObj,
        is_enabled: formData.is_enabled,
        notify_on_failure: formData.notify_on_failure ?? true,
        notification_email: formData.notification_email?.trim() || null,
        next_run_at: new Date().toISOString(),
      };

      if (isDemoMode || !isSupabaseConfigured) {
        const newEndpoint: MonitoredEndpoint = {
          ...payload,
          id: `e1000000-0000-0000-0000-${Date.now().toString().slice(-12)}`,
          user_id: user?.id || 'demo-user',
          last_run_at: null,
          lease_expires_at: null,
          last_alert_sent_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        localEndpoints.unshift(newEndpoint);
        return newEndpoint;
      }

      const { data, error } = await supabase
        .from('monitored_endpoints')
        .insert({ ...payload, user_id: user!.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: EndpointFormData }) => {
      const queryParamsObj: Record<string, string> = {};
      formData.query_params.forEach(({ key, value }) => {
        if (key.trim()) queryParamsObj[key.trim()] = value;
      });

      const headersObj: Record<string, string> = {};
      formData.headers.forEach(({ key, value }) => {
        if (key.trim()) headersObj[key.trim()] = value;
      });

      const payload = {
        name: formData.name.trim(),
        endpoint_url: formData.endpoint_url.trim(),
        interval_seconds: formData.interval_seconds,
        request_timeout_ms: formData.request_timeout_ms,
        query_params: queryParamsObj,
        headers: headersObj,
        is_enabled: formData.is_enabled,
        notify_on_failure: formData.notify_on_failure ?? true,
        notification_email: formData.notification_email?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isDemoMode || !isSupabaseConfigured) {
        localEndpoints = localEndpoints.map((ep) =>
          ep.id === id ? { ...ep, ...payload } : ep
        );
        return localEndpoints.find((ep) => ep.id === id);
      }

      const { data, error } = await supabase
        .from('monitored_endpoints')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const updatePayload: any = {
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      };
      if (isEnabled) {
        // Resuming endpoint sets next_run_at to NOW
        updatePayload.next_run_at = new Date().toISOString();
      }

      if (isDemoMode || !isSupabaseConfigured) {
        localEndpoints = localEndpoints.map((ep) =>
          ep.id === id ? { ...ep, ...updatePayload } : ep
        );
        return;
      }

      const { error } = await supabase
        .from('monitored_endpoints')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode || !isSupabaseConfigured) {
        localEndpoints = localEndpoints.filter((ep) => ep.id !== id);
        return;
      }

      const { error } = await supabase
        .from('monitored_endpoints')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
  });

  return {
    endpoints: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createEndpoint: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateEndpoint: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    toggleEndpoint: toggleMutation.mutateAsync,
    deleteEndpoint: deleteMutation.mutateAsync,
  };
}
