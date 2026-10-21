# VigilAPI Deployment Guide

This guide provides end-to-end, production-ready deployment instructions for **VigilAPI** across Supabase infrastructure (PostgreSQL, pg_cron, pg_net, Edge Functions) and web hosting platforms (Vercel, Netlify, Cloudflare Pages).

---

## 1. System Architecture Overview

VigilAPI operates completely independently of client sessions:
- **Scheduling**: Managed by PostgreSQL `pg_cron` running once per minute (`* * * * *`).
- **Invocation**: Triggered asynchronously via `pg_net` calling the Supabase Edge Function `dispatcher`.
- **Execution**: Claims due endpoints with atomic leases (`FOR UPDATE SKIP LOCKED`), applies SSRF/DNS screening, executes HTTP GET requests concurrently with timeouts, and records telemetry.
- **Retention**: Daily pg_cron job automatically purges records older than 7 days, maintaining database size below 20 MB (comfortably within Supabase's 500 MB free tier).

---

## 2. Prerequisites

- **Supabase Account**: [https://database.new](https://database.new)
- **Node.js**: v18+ (tested on v22.14.0)
- **npm**: v9+
- **Supabase CLI**: (optional, `npx supabase`)

---

## 3. Step 1: Database Setup & Migrations

If you are setting up a fresh Supabase project:

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor** on the left navigation panel.
3. Open [`supabase/migrations/20240101000000_init_schema.sql`](supabase/migrations/20240101000000_init_schema.sql) in this repository, copy its entire contents, and paste it into the SQL editor.
4. Click **Run**.

### Verification
Run this query in the SQL Editor to confirm all components are installed:
```sql
SELECT 
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'monitored_endpoints') AS endpoints_table,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'endpoint_executions') AS executions_table,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'claim_due_endpoints') AS claim_rpc,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'record_execution_and_reschedule') AS record_rpc,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'purge_expired_executions') AS purge_rpc;
```
All columns should return `true`.

---

## 4. Step 2: Edge Function Deployment (`dispatcher`)

The dispatcher function executes health checks, screens for SSRF, and records results.

### Option A: Deploy via Supabase CLI (Recommended)

1. Obtain a Personal Access Token from [Supabase Account Tokens](https://supabase.com/dashboard/account/tokens).
2. Log into the CLI:
   ```bash
   npx supabase login --token <your-personal-access-token>
   ```
3. Link your project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
4. Set the scheduler secret:
   ```bash
   npx supabase secrets set SCHEDULER_SECRET=vigilapi_secret_key_2026 --project-ref <your-project-ref>
   ```
5. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy dispatcher --project-ref <your-project-ref> --no-verify-jwt
   ```

### Option B: Deploy via Supabase Web Dashboard (Zero CLI)

1. Go to **Edge Functions** in your Supabase Dashboard:  
   `https://supabase.com/dashboard/project/<your-project-ref>/functions`
2. Click **Create Function**, enter the name **`dispatcher`**.
3. Copy the complete standalone code from [`supabase/functions/dispatcher/standalone.ts`](supabase/functions/dispatcher/standalone.ts).
4. Paste into the web editor, save, and deploy.
5. In **Edge Functions -> Secrets**, add:
   - `SCHEDULER_SECRET` = `vigilapi_secret_key_2026`

---

## 5. Step 3: Register pg_cron Recurring Schedules

In the Supabase **SQL Editor**, run the following script:

```sql
-- 1. Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Schedule the 1-minute central dispatcher trigger
SELECT cron.schedule(
  'vigilapi-minute-dispatcher',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Scheduler-Secret', 'vigilapi_secret_key_2026'
    ),
    body := '{"batch_size": 50, "lease_seconds": 120}'::jsonb
  );
  $$
);

-- 3. Schedule daily retention cleanup at 03:00 UTC (purges logs older than 7 days)
SELECT cron.schedule(
  'vigilapi-daily-retention-purge',
  '0 3 * * *',
  $$ SELECT purge_expired_executions(7); $$
);
```

### Inspect Scheduled Jobs & Execution Logs
```sql
-- Check active cron jobs
SELECT jobid, jobname, schedule, active FROM cron.job;

-- Check execution history of the cron jobs
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 6. Step 4: Frontend Web Application Deployment

### Option A: Deploy to Vercel

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), import your GitHub repository (`trigger_run`).
3. Set the Environment Variables:
   - `VITE_SUPABASE_URL`: `https://<your-project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `<your-supabase-anon-key>`
4. Build Settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**.

Alternatively, via Vercel CLI:
```bash
npx vercel deploy --prod
```

### Option B: Deploy to Netlify

1. In the [Netlify Dashboard](https://app.netlify.com), select **Add new site** -> **Import an existing project**.
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Click **Deploy Site**.

### Option C: Run Production Build Locally

```bash
# Build the production bundle
npm run build

# Start the local production preview server
npm run preview
```
Visit [http://localhost:4173](http://localhost:4173) in your browser.

---

## 7. Step 5: Smoke-Test & Verification Procedure

### Test 1: Real-time Manual Health Check
1. Log into your VigilAPI instance and click **New Endpoint**.
2. Configure:
   - **Name**: `HttpBin Status 200`
   - **Target URL**: `https://httpbin.org/status/200`
   - **Interval**: `5m` (300 seconds)
   - **Timeout**: `5s`
3. Click **Save & Activate**.
4. In the Endpoints list, click the **⚡ Test Run Now** button.
5. Verify that a `200 OK` record appears in the **Execution History** drawer within 2 seconds.

### Test 2: The Browser Shutdown Verification
1. Note the current time.
2. Log out of VigilAPI.
3. **Close your browser completely and shut down your computer (or close all tabs)**.
4. Wait **15 minutes**.
5. Re-open your browser and navigate back to VigilAPI.
6. Open **Execution History**:
   - You will see 3 consecutive executions that were triggered and saved in PostgreSQL at exactly 5-minute intervals while your machine was closed and offline.

---

## 8. Troubleshooting & Maintenance

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| `Edge function returns 401` | Mismatched `X-Scheduler-Secret` | Verify that the secret in `cron.schedule` matches the `SCHEDULER_SECRET` set in Edge Function secrets. |
| `Executions not advancing` | Cron job inactive or wrong URL | Run `SELECT * FROM cron.job` and verify `active = true` and the URL matches your project ref. |
| `SSRF_BLOCKED on internal URL` | IP is in reserved/private range | VigilAPI intentionally blocks localhost, RFC 1918, and metadata IPs (`169.254.169.254`). Use a public internet domain. |
| `Database approaching storage limit` | High volume of executions | Run `SELECT purge_expired_executions(3);` to shorten retention to 3 days. |
