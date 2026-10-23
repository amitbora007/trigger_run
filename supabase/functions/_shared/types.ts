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

export interface EndpointExecution {
  id?: string;
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
  created_at?: string;
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
