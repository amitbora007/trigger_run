# VigilAPI Agent & Autonomous Worker Architecture

## 1. Overview

VigilAPI employs a distributed, asynchronous autonomous agent architecture. Instead of monolithic background processes, tasks are decomposed into specialized, autonomous workers with strict boundaries, idempotency guarantees, and self-healing leases.

This document outlines the roles, responsibilities, operational contracts, and state interfaces for all system agents and workers.

---

## 2. Agent Catalog & Roles

```
                                  +------------------------------+
                                  |     pg_cron Orchestrator     |
                                  +--------------+---------------+
                                                 |
                         +-----------------------+-----------------------+
                         | (Every 1 min)                                 | (Daily 03:00 UTC)
                         v                                               v
            +--------------------------+                   +---------------------------+
            | Dispatcher Agent         |                   | Retention Cleaner Agent   |
            | (edge-dispatcher-agent)  |                   | (retention-cleaner-agent) |
            +------------+-------------+                   +---------------------------+
                         |
       +-----------------+-----------------+
       | Spawns concurrent tasks           |
       v                                   v
+--------------------------+    +--------------------------+
| HTTP Worker Agent 1      |    | HTTP Worker Agent N      |
| (http-worker-agent)      |    | (http-worker-agent)      |
+--------------------------+    +--------------------------+
```

---

## 3. Agent 1: The Dispatcher Agent (`edge-dispatcher-agent`)

### 3.1 Purpose & Role
The Dispatcher Agent is the central coordinator executed inside a Supabase Edge Function environment once per minute. Its mission is to discover endpoints due for health checks, acquire atomic leases without race conditions, partition work into concurrent tasks, and ensure complete execution within serverless execution limits.

### 3.2 Operational Specifications
- **Runtime Environment**: Deno / TypeScript (Supabase Edge Function).
- **Trigger**: Inbound HTTP POST authenticated via `X-Scheduler-Secret`.
- **Concurrency Budget**: Up to 10 simultaneous HTTP executions per batch.
- **Maximum Batch Size**: 50 endpoints per invocation.
- **Lease Duration**: 120 seconds.
- **Idempotency Guarantee**: `claim_due_endpoints()` using PostgreSQL `FOR UPDATE SKIP LOCKED`.

### 3.3 Autonomous Self-Healing Behavior
- If a prior dispatcher run crashed or terminated prematurely, claimed endpoints remain locked until their `lease_expires_at` timestamp.
- On the subsequent minute's run, the query `(lease_expires_at IS NULL OR lease_expires_at < NOW())` automatically recovers and claims abandoned jobs.

### 3.4 Operational Contract
```typescript
interface DispatcherRequest {
  batch_size?: number;     // Default: 50
  lease_seconds?: number;  // Default: 120
}

interface DispatcherResponse {
  success: boolean;
  claimed_count: number;
  completed_count: number;
  failed_count: number;
  execution_duration_ms: number;
  correlation_id: string;
}
```

---

## 4. Agent 2: The HTTP Worker Agent (`http-worker-agent`)

### 4.1 Purpose & Role
The HTTP Worker Agent is an ephemeral execution worker spawned by the Dispatcher to process a single claimed endpoint. It is responsible for security validation (SSRF check), network transmission, latency timing, response capture, and result persistence.

### 4.2 Security & Safety Checklist
1. **SSRF Screening**:
   - Parses target URL into protocol, hostname, and port.
   - Enforces protocol `http:` or `https:`.
   - Enforces port `80`, `443`, `8080`, or `8443`.
   - Performs DNS resolution pre-check.
   - Verifies all resolved IP addresses against the private/link-local/multicast blacklist.
2. **Execution Timing & Timeout**:
   - Bounds the fetch operation using `AbortSignal.timeout(endpoint.request_timeout_ms)`.
   - Starts high-resolution timer: `const start = performance.now()`.
3. **Response Capture & Sanitization**:
   - Extracts HTTP status code.
   - Filters headers through the safe-list (`content-type`, `content-length`, `server`, `date`, `etag`, `cache-control`).
   - Reads response text up to 32 KB. Sets `is_truncated = true` if response stream continues beyond limit.
4. **Reschedule & Persist**:
   - Invokes `record_execution_and_reschedule` database RPC.
   - Clears `lease_expires_at` and sets next run using non-storm catch-up logic.

### 4.3 Error Classification Taxonomy
The Worker categorizes failures into deterministic categories:
- `SSRF_BLOCKED`: URL resolved to a forbidden local, private, or metadata IP.
- `TIMEOUT`: Request exceeded configured timeout threshold.
- `DNS_ERROR`: Hostname could not be resolved.
- `CONNECTION_REFUSED`: Host reachable but rejected connection on specified port.
- `HTTP_ERROR`: Valid response received, but status was $4xx$ or $5xx$.
- `PAYLOAD_TOO_LARGE`: Response exceeded memory limits or protocol size caps.
- `UNKNOWN`: Unhandled network or TLS socket error.

---

## 5. Agent 3: Retention Cleaner Agent (`retention-cleaner-agent`)

### 5.1 Purpose & Role
Runs once every 24 hours at 03:00 UTC directly within PostgreSQL via `pg_cron`. It purges execution records older than the retention threshold (default: 7 days) to preserve Supabase Free Tier storage limits (500 MB maximum database size).

### 5.2 Execution Logic
```sql
SELECT purge_expired_executions(p_retention_days := 7);
```

### 5.3 Vacuum & Catalog Health
Following deletion, PostgreSQL's auto-vacuum daemon reclaims dead tuples, ensuring indexes on `endpoint_executions` remain compact and cache-efficient.

---

## 6. Agent 4: Health Watchdog Agent (`health-watchdog-agent`)

### 6.1 Purpose & Role
An administrative diagnostic agent capable of surveying the health of the monitoring topology. It inspects:
1. **Dispatcher Heartbeat**: Verifies that the last execution completed within the last 120 seconds.
2. **Oldest Overdue Endpoint**: Identifies endpoints whose `next_run_at` is in the past by more than 5 minutes.
3. **Lease Exhaustion**: Identifies any endpoints stuck in expired leases.

### 6.2 Diagnostic Query
```sql
CREATE OR REPLACE VIEW v_system_health_watchdog AS
SELECT
  NOW() AS current_time,
  (SELECT MAX(created_at) FROM endpoint_executions) AS last_execution_time,
  EXTRACT(EPOCH FROM (NOW() - (SELECT MAX(created_at) FROM endpoint_executions)))::INT AS seconds_since_last_run,
  (SELECT COUNT(*) FROM monitored_endpoints WHERE is_enabled = true AND next_run_at < NOW() - INTERVAL '5 minutes') AS overdue_endpoints_count,
  (SELECT COUNT(*) FROM monitored_endpoints WHERE lease_expires_at > NOW()) AS currently_leased_count;
```

---

## 7. Autonomous AI Incident Agent Integration (Future Extensibility)

VigilAPI's data model is engineered for direct integration with LLM agents (such as Google Gemini via the Google Antigravity SDK).

When an endpoint suffers consecutive failures:
1. An event trigger dispatches execution telemetry (`status_code`, `response_body`, `sanitized_error_message`) to an AI triage agent.
2. The agent analyzes previous runs, compares latency anomalies, and drafts an incident summary.
3. The summary is displayed in the dashboard and sent via webhook (Slack/Discord/Email) to the user.
