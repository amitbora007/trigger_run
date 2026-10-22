-- ==============================================================================
-- VigilAPI: Database Migration 20240103000000_security_invoker_view.sql
-- Enforce security_invoker = true on public.v_system_health_watchdog
-- Resolves Supabase Security Advisor "Security Definer View" warning
-- ==============================================================================

ALTER VIEW public.v_system_health_watchdog SET (security_invoker = true);
