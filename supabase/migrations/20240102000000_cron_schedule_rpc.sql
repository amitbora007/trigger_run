-- ==============================================================================
-- VigilAPI: Database Migration 20240102000000_cron_schedule_rpc.sql
-- Exposes SECURITY DEFINER RPCs for reading and rescheduling pg_cron dispatcher
-- ==============================================================================

-- 1. Read Current pg_cron Dispatcher Schedule
CREATE OR REPLACE FUNCTION public.get_dispatcher_cron_schedule(
  p_job_name TEXT DEFAULT 'vigilapi-minute-dispatcher'
)
RETURNS TABLE (
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  active BOOLEAN,
  jobname TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobid,
    j.schedule,
    j.command,
    j.active,
    j.jobname
  FROM cron.job j
  WHERE j.jobname = p_job_name
  LIMIT 1;
END;
$$;

-- 2. Securely Reschedule pg_cron Dispatcher
CREATE OR REPLACE FUNCTION public.update_dispatcher_cron_schedule(
  p_schedule TEXT,
  p_job_name TEXT DEFAULT 'vigilapi-minute-dispatcher'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, public
AS $$
DECLARE
  v_jobid BIGINT;
  v_trimmed TEXT;
  v_parts TEXT[];
BEGIN
  v_trimmed := trim(p_schedule);
  v_parts := string_to_array(v_trimmed, ' ');

  -- Validate standard 5-part cron syntax
  IF array_length(v_parts, 1) != 5 THEN
    RAISE EXCEPTION 'Invalid cron expression "%": Expected exactly 5 space-separated fields (minute hour day month day-of-week).', v_trimmed;
  END IF;

  -- Locate the dispatcher cron job
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = p_job_name;

  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cron job ' || quote_literal(p_job_name) || ' not found in cron.job. Please create it first in Supabase SQL Editor.'
    );
  END IF;

  -- Update cron schedule atomically via pg_cron alter_job
  PERFORM cron.alter_job(job_id := v_jobid, schedule := v_trimmed);

  RETURN jsonb_build_object(
    'success', true,
    'jobid', v_jobid,
    'jobname', p_job_name,
    'schedule', v_trimmed,
    'updated_at', timezone('utc'::text, now())
  );
END;
$$;

-- 3. Execution Permissions
GRANT EXECUTE ON FUNCTION public.get_dispatcher_cron_schedule(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_dispatcher_cron_schedule(TEXT, TEXT) TO authenticated, anon;
