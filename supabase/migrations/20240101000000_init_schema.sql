-- ==============================================================================
-- VigilAPI: Database Migration 20240101000000_init_schema.sql
-- Multi-tenant API Monitoring Architecture with Atomic Leases & Bounded Catch-Up
-- ==============================================================================

-- 1. Prerequisites & Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pg_cron and pg_net are enabled in Supabase by default or via dashboard
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Profiles Table (Synchronized with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Monitored Endpoints Table
CREATE TABLE IF NOT EXISTS public.monitored_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  interval_seconds INTEGER NOT NULL DEFAULT 300,
  request_timeout_ms INTEGER NOT NULL DEFAULT 10000,
  query_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_run_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Engineering Constraints
  CONSTRAINT chk_method_get CHECK (method = 'GET'),
  CONSTRAINT chk_min_interval CHECK (interval_seconds >= 300),
  CONSTRAINT chk_timeout_range CHECK (request_timeout_ms BETWEEN 1000 AND 30000),
  CONSTRAINT chk_url_length CHECK (char_length(endpoint_url) <= 2048),
  CONSTRAINT chk_name_length CHECK (char_length(name) BETWEEN 1 AND 128)
);

-- 4. Endpoint Executions Table
CREATE TABLE IF NOT EXISTS public.endpoint_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.monitored_endpoints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_category TEXT,
  sanitized_error_message TEXT,
  response_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_body TEXT,
  is_truncated BOOLEAN NOT NULL DEFAULT false,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Error Taxonomy Constraint
  CONSTRAINT chk_error_category CHECK (
    error_category IS NULL OR
    error_category IN (
      'DNS_ERROR',
      'TIMEOUT',
      'CONNECTION_REFUSED',
      'HTTP_ERROR',
      'SSRF_BLOCKED',
      'PAYLOAD_TOO_LARGE',
      'UNKNOWN'
    )
  )
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_endpoints_scheduler_claim 
ON public.monitored_endpoints (next_run_at ASC, lease_expires_at) 
WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_endpoints_user 
ON public.monitored_endpoints (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_endpoint_history 
ON public.endpoint_executions (endpoint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_user_analytics 
ON public.endpoint_executions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_retention_purge 
ON public.endpoint_executions (created_at ASC);

-- 6. Row-Level Security (RLS) Configuration
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_executions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Monitored Endpoints Policies
DROP POLICY IF EXISTS "Users can read own endpoints" ON public.monitored_endpoints;
CREATE POLICY "Users can read own endpoints"
  ON public.monitored_endpoints FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own endpoints" ON public.monitored_endpoints;
CREATE POLICY "Users can create own endpoints"
  ON public.monitored_endpoints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own endpoints" ON public.monitored_endpoints;
CREATE POLICY "Users can update own endpoints"
  ON public.monitored_endpoints FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own endpoints" ON public.monitored_endpoints;
CREATE POLICY "Users can delete own endpoints"
  ON public.monitored_endpoints FOR DELETE
  USING (auth.uid() = user_id);

-- Endpoint Executions Policies (Users can only read; writes performed via secure RPC / service role)
DROP POLICY IF EXISTS "Users can read own executions" ON public.endpoint_executions;
CREATE POLICY "Users can read own executions"
  ON public.endpoint_executions FOR SELECT
  USING (auth.uid() = user_id);

-- 7. High-Performance Stored Procedures & Atomic Claim Operations

-- 7.1 Atomic Claim with Expiring Lease (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_due_endpoints(
  p_batch_size INT DEFAULT 50,
  p_lease_seconds INT DEFAULT 120
)
RETURNS SETOF public.monitored_endpoints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due_candidates AS (
    SELECT id
    FROM public.monitored_endpoints
    WHERE is_enabled = true
      AND next_run_at <= timezone('utc'::text, now())
      AND (lease_expires_at IS NULL OR lease_expires_at < timezone('utc'::text, now()))
    ORDER BY next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.monitored_endpoints e
  SET
    lease_expires_at = timezone('utc'::text, now()) + (p_lease_seconds || ' seconds')::INTERVAL,
    updated_at = timezone('utc'::text, now())
  FROM due_candidates c
  WHERE e.id = c.id
  RETURNING e.*;
END;
$$;

-- 7.2 Result Persistence & Deterministic Bounded Rescheduling
CREATE OR REPLACE FUNCTION public.record_execution_and_reschedule(
  p_endpoint_id UUID,
  p_user_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_started_at TIMESTAMPTZ,
  p_completed_at TIMESTAMPTZ,
  p_status_code INT,
  p_response_time_ms INT,
  p_success BOOLEAN,
  p_error_category TEXT,
  p_sanitized_error_message TEXT,
  p_response_headers JSONB,
  p_response_body TEXT,
  p_is_truncated BOOLEAN,
  p_correlation_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert telemetry record
  INSERT INTO public.endpoint_executions (
    endpoint_id,
    user_id,
    scheduled_at,
    started_at,
    completed_at,
    status_code,
    response_time_ms,
    success,
    error_category,
    sanitized_error_message,
    response_headers,
    response_body,
    is_truncated,
    correlation_id
  ) VALUES (
    p_endpoint_id,
    p_user_id,
    p_scheduled_at,
    p_started_at,
    p_completed_at,
    p_status_code,
    p_response_time_ms,
    p_success,
    p_error_category,
    p_sanitized_error_message,
    COALESCE(p_response_headers, '{}'::jsonb),
    p_response_body,
    COALESCE(p_is_truncated, false),
    p_correlation_id
  );

  -- Advance next_run_at with non-storm catch-up guarantee
  UPDATE public.monitored_endpoints
  SET
    last_run_at = p_started_at,
    lease_expires_at = NULL,
    next_run_at = GREATEST(
      timezone('utc'::text, now()),
      p_scheduled_at + (interval_seconds || ' seconds')::INTERVAL
    ),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_endpoint_id;
END;
$$;

-- 7.3 Daily Retention Cleanup RPC (Default 7 Days)
CREATE OR REPLACE FUNCTION public.purge_expired_executions(
  p_retention_days INT DEFAULT 7
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM public.endpoint_executions
  WHERE created_at < timezone('utc'::text, now()) - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 7.4 System Diagnostic View for Monitoring Dispatcher Health
CREATE OR REPLACE VIEW public.v_system_health_watchdog
WITH (security_invoker = true) AS
SELECT
  timezone('utc'::text, now()) AS current_time_utc,
  (SELECT MAX(created_at) FROM public.endpoint_executions) AS last_execution_time,
  EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - (SELECT MAX(created_at) FROM public.endpoint_executions)))::INT AS seconds_since_last_run,
  (SELECT COUNT(*) FROM public.monitored_endpoints WHERE is_enabled = true AND next_run_at < timezone('utc'::text, now()) - INTERVAL '5 minutes') AS overdue_endpoints_count,
  (SELECT COUNT(*) FROM public.monitored_endpoints WHERE lease_expires_at > timezone('utc'::text, now())) AS currently_leased_count;
