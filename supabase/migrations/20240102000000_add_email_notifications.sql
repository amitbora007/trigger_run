-- Migration: Add Email Notification columns to monitored_endpoints
-- Supports Resend automated alert notifications on health check failures

ALTER TABLE public.monitored_endpoints
ADD COLUMN IF NOT EXISTS notify_on_failure BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_email TEXT,
ADD COLUMN IF NOT EXISTS last_alert_sent_at TIMESTAMPTZ;

-- Index for notification query lookups
CREATE INDEX IF NOT EXISTS idx_endpoints_notifications
ON public.monitored_endpoints (notify_on_failure)
WHERE notify_on_failure = true;
