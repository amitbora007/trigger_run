# VigilAPI Architecture Specification

## 1. Executive Overview

VigilAPI is an enterprise-grade, serverless HTTP endpoint monitoring platform designed specifically for the Supabase ecosystem (PostgreSQL, Supabase Auth, pg_cron, pg_net, Supabase Edge Functions) and a React/TypeScript frontend.

The platform provides resilient, multi-tenant HTTP GET health checking that operates **100% independently of client sessions**. Once a user configures an endpoint, monitoring persists continuously without requiring browser tabs, local background processes, standing virtual machines, or paid third-party monitoring vendors.

---

## 2. Architecture Principles & Constraints

| Principle | Implementation Strategy |
| :--- | :--- |
| **Zero Client Reliance** | Scheduling and execution live entirely in managed cloud infrastructure (`pg_cron` + Supabase Edge Functions). |
| **Zero Cost (Free Tier Eligible)** | Centralized dispatcher batches executions to stay within the 500,000 monthly Edge Function invocation limit. Automated 7-day retention keeps DB size well below 500 MB. |
| **No Overlapping Executions** | Database-level atomic claim and row-level locking (`FOR UPDATE SKIP LOCKED`) guarantees that no endpoint is executed by multiple concurrent workers. |
| **Fault Tolerance & Leases** | Ephemeral execution leases (`lease_expires_at`) automatically recover endpoints if a serverless worker suffers an abrupt failure or container termination. |
| **SSRF In-Depth Defense** | Multi-layer IP blocking (IPv4, IPv6, private CIDRs, cloud metadata, octal/hex encodings) and DNS resolution pre-checks prevent Server-Side Request Forgery. |
| **Zero Secret Leakage** | Hop-by-hop stripping, authorization redaction, and strict safe-list response filtering guarantee sensitive credentials never leak to logs, DB, or frontend. |

---

## 3. High-Level System Architecture

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (React 19 + TypeScript + MUI)"]
        SPA["Single Page App (Vite + React)"]
        AuthUI["Auth State (Supabase Auth Context)"]
        QueryClient["TanStack Query Cache (5s-15s TTL)"]
    end

    subgraph AuthGateway ["Authentication & Security Boundary"]
        SupabaseAuth["GoTrue / Supabase Auth"]
        RLS["PostgreSQL Row-Level Security (RLS)"]
    end

    subgraph DataLayer ["PostgreSQL 15+ Core Database"]
        ProfilesTbl[("profiles")]
        EndpointsTbl[("monitored_endpoints")]
        ExecutionsTbl[("endpoint_executions")]
        ClaimFunc["RPC: claim_due_endpoints()"]
        RecordFunc["RPC: record_execution_and_reschedule()"]
        PurgeFunc["RPC: purge_expired_executions()"]
        CronExt["pg_cron (Scheduler Daemon)"]
        NetExt["pg_net (HTTP Asynchronous Invocation)"]
    end

    subgraph ComputeLayer ["Serverless Execution (Supabase Edge Functions / Deno)"]
        Dispatcher["Edge Function: dispatcher"]
        SSRFEngine["SSRF & DNS Validator Engine"]
        WorkerPool["Concurrent Async HTTP Worker Pool"]
    end

    subgraph TargetEcosystem ["External Web Ecosystem"]
        ExternalEndpoint["Target HTTP GET Service"]
    end

    %% Flow connections
    SPA --> AuthUI
    AuthUI --> SupabaseAuth
    SPA -->|Authenticated JWT| RLS
    RLS --> ProfilesTbl
    RLS --> EndpointsTbl
    RLS --> ExecutionsTbl

    %% Scheduler pipeline
    CronExt -->|Every minute (* * * * *)| NetExt
    NetExt -->|Secure POST with SCHEDULER_SECRET| Dispatcher
    Dispatcher -->|1. Atomic Claim (Batch <= 50)| ClaimFunc
    ClaimFunc -->|Lock & Return Claimed Rows| EndpointsTbl
    Dispatcher -->|2. Validate Safe Destination| SSRFEngine
    SSRFEngine -->|3. Safe Destination Confirmed| WorkerPool
    WorkerPool -->|4. HTTP GET (Bounded Timeout)| ExternalEndpoint
    ExternalEndpoint -->|5. Status, Latency, Safe Body| WorkerPool
    WorkerPool -->|6. Persist & Advance next_run_at| RecordFunc
    RecordFunc --> EndpointsTbl
    RecordFunc --> ExecutionsTbl

    %% Daily cleanup
    CronExt -->|Daily at 03:00 UTC| PurgeFunc
    PurgeFunc -->|Delete older than 7 days| ExecutionsTbl
```

---

## 4. End-to-End Scheduling & Execution Lifecycle

### Step 1: Endpoint Registration & Scheduling Calculation
- An authenticated user defines an endpoint with a name, target URL, and execution interval (minimum 300 seconds / 5 minutes).
- Upon insertion into `monitored_endpoints`, `next_run_at` is set to `NOW()`, making it immediately eligible for its initial run.

### Step 2: Recurring Cron Dispatcher Trigger
- The `pg_cron` extension triggers at the start of every minute (`* * * * *`).
- It executes a SQL statement using `net.http_post()` targeting the Supabase Edge Function:
  ```sql
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_url') || '/dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Scheduler-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scheduler_secret')
    ),
    body := '{"batch_size": 50, "lease_seconds": 120}'::jsonb
  );
  ```
- **Zero Token/Session Overhead**: The cron trigger runs at the PostgreSQL daemon level.

### Step 3: Atomic Batch Claiming (`claim_due_endpoints`)
To prevent concurrent workers or overlapping runs from executing the same endpoint:
```sql
CREATE OR REPLACE FUNCTION claim_due_endpoints(
  p_batch_size INT DEFAULT 50,
  p_lease_seconds INT DEFAULT 120
)
RETURNS SETOF monitored_endpoints
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH due_candidates AS (
    SELECT id
    FROM monitored_endpoints
    WHERE is_enabled = true
      AND next_run_at <= NOW()
      AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
    ORDER BY next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE monitored_endpoints e
  SET lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
      updated_at = NOW()
  FROM due_candidates c
  WHERE e.id = c.id
  RETURNING e.*;
END;
$$;
```
- **`FOR UPDATE SKIP LOCKED`**: Concurrent dispatcher invocations skip rows currently being claimed, completely avoiding deadlock and duplicate work.
- **Expiring Lease**: If an execution worker crashes or hits an out-of-memory condition, its lease expires after 120 seconds. The next minute's dispatcher picks up the abandoned endpoint automatically.

### Step 4: Non-Blocking HTTP Execution & SSRF Enforcement
- Database locks are released as soon as the `claim_due_endpoints` transaction commits.
- The Edge Function executes the claimed batch concurrently with a bounded pool (e.g. concurrency limit of 10).
- For each target URL:
  1. Parse scheme (only `http:` and `https:` permitted).
  2. Parse port (only `80`, `443`, `8080`, `8443` permitted).
  3. Validate IP address (or resolve DNS domain and validate all returned A/AAAA records).
  4. Abort immediately if the address resolves to loopback, private RFC 1918, link-local metadata (`169.254.169.254`), or multicast.
  5. Fire the HTTP request using `fetch()` with an `AbortController` bounded by `request_timeout_ms` (max 30,000 ms).
  6. Measure wall-clock response latency using high-resolution timers (`performance.now()`).
  7. Filter response headers against an allowed safe-list.
  8. Truncate response body to 32 KB.

### Step 5: Execution Record Persistence & Deterministic Rescheduling
The worker invokes `record_execution_and_reschedule`:
```sql
CREATE OR REPLACE FUNCTION record_execution_and_reschedule(
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
AS $$
BEGIN
  -- Insert detailed telemetry
  INSERT INTO endpoint_executions (
    endpoint_id, user_id, scheduled_at, started_at, completed_at,
    status_code, response_time_ms, success, error_category,
    sanitized_error_message, response_headers, response_body,
    is_truncated, correlation_id
  ) VALUES (
    p_endpoint_id, p_user_id, p_scheduled_at, p_started_at, p_completed_at,
    p_status_code, p_response_time_ms, p_success, p_error_category,
    p_sanitized_error_message, p_response_headers, p_response_body,
    p_is_truncated, p_correlation_id
  );

  -- Update endpoint with bounded catch-up next_run_at
  UPDATE monitored_endpoints
  SET
    last_run_at = p_started_at,
    lease_expires_at = NULL,
    next_run_at = GREATEST(NOW(), p_scheduled_at + (interval_seconds || ' seconds')::INTERVAL),
    updated_at = NOW()
  WHERE id = p_endpoint_id;
END;
$$;
```

---

## 5. Bounded Catch-Up & Non-Storm Scheduling Semantics

A common flaw in naive cron schedulers is the "stampede effect": if a system goes down for 2 hours, upon recovery a 5-minute endpoint might try to fire 24 consecutive times in an uncontrolled storm.

VigilAPI enforces a **Deterministic Bounded Catch-Up Policy**:
$$\text{next\_run\_at} = \max(\text{NOW}(), \text{scheduled\_at} + \text{interval\_seconds})$$

- If an execution is on-time (e.g., scheduled at 12:00:00, executed at 12:00:05), the next run is `12:00:00 + 300s = 12:05:00`.
- If an execution is delayed (e.g. system paused, executed 45 minutes later at 12:45:00), `12:00:00 + 300s = 12:05:00 < NOW()`. The `GREATEST` clause bumps the `next_run_at` to `NOW()`, scheduling the next run for `NOW() + interval_seconds`.
- **Guarantee**: There is never a backlog queue storm. Endpoints simply resume regular periodic cadences.

---

## 6. Security Boundaries & Threat Modeling

```
+------------------------------------------------------------------------+
| UNTRUSTED EXTERNAL INTERNET                                           |
| (Target APIs, web servers, CDNs)                                       |
+-----------------------------------+------------------------------------+
                                    | HTTP Responses (Untrusted)
                                    v
+------------------------------------------------------------------------+
| EDGE EXECUTION SANDBOX (Supabase Edge Function)                        |
| - SSRF Validator (Blocks 127.0.0.1, 169.254.169.254, RFC 1918)        |
| - Response Sanitizer (Filters allowed headers, truncates body to 32KB) |
| - Error Sanitizer (Removes internal stack traces)                      |
+-----------------------------------+------------------------------------+
                                    | Service Role RPC (Internal only)
                                    v
+------------------------------------------------------------------------+
| POSTGRESQL DATABASE                                                    |
| - Row Level Security (Users can only query their own endpoints/logs)   |
| - SECURITY DEFINER functions for atomic scheduling                     |
| - Automatic daily 7-day log purge                                      |
+-----------------------------------+------------------------------------+
                                    | Authenticated Session JWT
                                    v
+------------------------------------------------------------------------+
| FRONTEND BROWSER (React + TypeScript)                                  |
| - Redacted Auth Headers (Passwords/Tokens NEVER returned or displayed) |
| - Safe JSON Tree Viewer (No arbitrary HTML rendering - XSS safe)       |
+-----------------------------------+------------------------------------+
```

---

## 7. Supabase Free-Tier Optimization Strategy

| Metric / Resource | Supabase Free Quota | VigilAPI Usage Profile | Safety Margin |
| :--- | :--- | :--- | :--- |
| **Edge Function Invocations** | 500,000 / month | 1 cron/min $\times 43,200$ min/mo = 43,200 invocations | **> 91% headroom** |
| **Edge Function Concurrency** | 100 simultaneous | Max 10 concurrent requests per batch | **10x safety buffer** |
| **PostgreSQL Database Storage** | 500 MB | 20 endpoints @ 5 min interval = ~4,000 records/day. With 7-day retention: ~28,000 rows $\approx$ 15 MB | **> 95% storage headroom** |
| **pg_cron Jobs** | Unlimited scheduled tasks | Exactly 2 jobs: 1 dispatcher (* * * * *) and 1 retention cleaner (daily) | Minimal catalog footprint |
| **Egress Bandwidth** | 5 GB / month | Only request headers + up to 32 KB body stored. Monthly egress < 250 MB | **> 95% bandwidth headroom** |
