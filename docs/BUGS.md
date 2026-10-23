# VigilAPI Bug Tracking & Vulnerability Analysis

This document details critical concurrency bugs, distributed systems edge cases, and security vulnerabilities identified during design, along with their implemented mitigations and automated verification procedures.

---

## 1. Concurrency & Scheduling Edge Cases

### BUG-001: Concurrent Dispatcher Race Condition (Duplicate Execution)
- **Severity**: Critical (High Duplicate Invocation Risk)
- **Problem**: When a dispatcher function runs longer than 60 seconds or multiple cron workers trigger near-simultaneously, two workers might query `WHERE next_run_at <= NOW()` at the exact same instant, receiving the same endpoints and firing duplicate external HTTP requests.
- **Root Cause**: Non-atomic read-then-write pattern without row-level locking.
- **Resolution**: Implemented `claim_due_endpoints()` using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **Mitigation Proof**: The first worker acquires row locks; concurrent workers skip the locked rows without waiting or blocking, guaranteeing zero duplicate claims.

### BUG-002: Abandoned Leases on Serverless Container Kill
- **Severity**: High (Permanent Endpoint Starvation)
- **Problem**: If an Edge Function execution environment runs out of memory, hits CPU quotas, or experiences a sudden SIGKILL, any endpoint that was "in-progress" could remain locked in a perpetual "running" state.
- **Root Cause**: Relying on explicit `status = 'idle'` updates in a finally block, which does not run if the process abruptly crashes.
- **Resolution**: Replaced boolean status locks with an ephemeral timestamp lease: `lease_expires_at = NOW() + INTERVAL '120 seconds'`.
- **Mitigation Proof**: The claim query includes `(lease_expires_at IS NULL OR lease_expires_at < NOW())`. If a worker dies, the endpoint is automatically released and reclaimed by the next cycle.

### BUG-003: Overdue Execution Stampede (Scheduler Stampede)
- **Severity**: High (Denial of Service on Monitored Endpoints)
- **Problem**: If the Supabase project is paused or the database is unavailable for several hours, a 5-minute endpoint might fall behind by dozens of missed runs. A naive queue might attempt to fire all 50 missed runs in rapid succession upon recovery.
- **Root Cause**: Calculating `next_run_at = scheduled_at + interval` iteratively from the past.
- **Resolution**: Enforced **Deterministic Bounded Catch-Up**:
  $$\text{next\_run\_at} = \max(\text{NOW}(), \text{scheduled\_at} + \text{interval})$$
- **Mitigation Proof**: When an overdue endpoint executes, its `next_run_at` advances to at least `NOW()`, preserving the minimum 5-minute interval and eliminating cascading request storms.

---

## 2. Security Vulnerabilities & Mitigations

### VULN-001: Server-Side Request Forgery (SSRF) to Cloud Metadata
- **Severity**: Critical (AWS/GCP/Azure Credential Extraction)
- **Attack Vector**: Attacker registers endpoint `http://169.254.169.254/latest/meta-data/` to extract instance identity tokens or cloud secrets.
- **Resolution**: Strict IP parser and CIDR filter checking `169.254.0.0/16` and `fe80::/10`.
- **Test Case**: Automated test `ssrf.test.ts` asserts that `http://169.254.169.254` throws `SSRF_BLOCKED`.

### VULN-002: SSRF via Hexadecimal / Octal / Decimal IP Obfuscation
- **Severity**: Critical (WAF / Filter Bypass)
- **Attack Vector**: Attacker provides `http://0x7f000001` or `http://2130706433` (evaluates to `127.0.0.1`) or `http://0177.0.0.1` (octal) to bypass naive string matching for `127.0.0.1`.
- **Resolution**: Canonical IP parsing converts any dotted-decimal, octal, hex, or integer representation into normalized 32-bit integer before evaluating against banned CIDRs.
- **Test Case**: `ssrf.test.ts` validates normalized rejection of `0x7f000001`, `2130706433`, and `0177.0000.0000.0001`.

### VULN-003: SSRF via DNS Rebinding
- **Severity**: High (Intranet Port Scanning)
- **Attack Vector**: Attacker controls a custom domain (e.g., `rebind.attacker.com`) configured with a short TTL (1 second). Initial validation resolves to a public IP, but during `fetch()`, the DNS server returns `127.0.0.1` or `10.0.0.1`.
- **Resolution**: In runtime environments where custom socket dialing is limited, pre-resolve domain A/AAAA records immediately before connection, validate all records, and enforce manual redirect checking.

### VULN-004: SSRF via HTTP 302 Redirect to Localhost
- **Severity**: High (SSRF Bypass via Redirect)
- **Attack Vector**: Attacker specifies public URL `https://attacker.com/redirect` which returns `HTTP 302 Location: http://localhost:5432`.
- **Resolution**: Set `redirect: 'manual'` in fetch options or validate redirect `Location` header against the SSRF engine before following.

### VULN-005: Sensitive Header Leakage in Execution Logs
- **Severity**: Medium (Credential Exposure)
- **Attack Vector**: User configures an endpoint with `Authorization: Bearer my-secret-token`. A compromised dashboard or read-only team member views full execution history and obtains credentials.
- **Resolution**:
  1. Frontend masks secret header values (`***REDACTED***`).
  2. Backend never includes `Authorization` header in execution logs.
  3. Response headers strictly filtered against a safe allowlist (`content-type`, `content-length`, `server`, etc.).

---

## 3. Storage & Reliability Bugs

### BUG-004: PostgreSQL Storage Exhaustion (Free Tier Limit)
- **Severity**: High (Database Halt at 500 MB)
- **Problem**: 20 endpoints running every 5 minutes generate 5,760 execution rows daily. Without cleanup, table size grows by ~150 MB monthly, causing database suspension after 3-4 months.
- **Resolution**: Implemented automated retention cleanup via `pg_cron` running daily at 03:00 UTC:
  `DELETE FROM endpoint_executions WHERE created_at < NOW() - INTERVAL '7 days'`.
- **Mitigation Proof**: Table size stabilizes at ~40,000 rows (~15-20 MB), leaving >95% storage free.

### BUG-005: Out-of-Memory from Gigantic Response Payloads
- **Severity**: Medium (Edge Function Crash)
- **Problem**: Monitored endpoint returns a 100 MB video file or continuous stream, exhausting the Edge Function's memory allocation (150 MB) and causing container crash.
- **Resolution**: Response stream reader caps consumption at 32 KB, immediately cancels the reader stream via `reader.cancel()`, and marks `is_truncated = true`.

---

## 4. Frontend Architecture, Authentication & Data Integrity Bugs

### BUG-006: Execution History Query Truncation (Silent 100-Record Ceiling)
- **Severity**: High (Telemetry Data Invisibility & Audit Inaccuracy)
- **Problem**: When navigating to Execution History, Dashboard Overview, or Analytics, only the first 100 execution records were ever queried from PostgreSQL. Historical audit records from earlier runs were silently excluded, even though they existed in the database and were well within the 7-day retention window.
- **Root Cause**: `useExecutions.ts` had a hardcoded `.limit(100)` applied whenever `filters?.limit` was omitted. In addition, `DashboardOverviewPage` passed `{ limit: 100 }`, capping the calculated metrics (uptime percentage, average latency, total count), and `AnalyticsPage` passed `{ limit: 500 }`.
- **Resolution**:
  1. Removed the default `.limit(100)` cap in `useExecutions.ts`.
  2. Implemented chunked range fetching using PostgreSQL `range(from, from + 999)` up to a safety ceiling of 10,000 records to seamlessly bypass PostgREST's default 1,000-row limit without memory exhaustion.
  3. Removed artificial limit arguments from `DashboardOverviewPage` and `AnalyticsPage` so that overview metrics and telemetry summaries reflect the true complete dataset.
- **Mitigation Proof**: Automated tests in `Pagination.test.tsx` verify multi-page traversal beyond 100 records and audit completeness.

### BUG-007: Password Validation Bypass & Auto-Authentication Fallback
- **Severity**: Critical (Authentication Bypass)
- **Problem**: Submitting the login form with an invalid password or non-existent username would log the user in anyway without error.
- **Root Cause**: In `AuthContext.tsx`, `isDemoMode` defaulted to `!isSupabaseConfigured`. If the client initialized before credentials resolved or if demo mode was previously active, `signIn()` took the branch `if (isDemoMode) { setUser({ ...DEMO_USER, email }); return { error: null }; }`. This completely bypassed Supabase authentication and accepted any credential pair.
- **Resolution**:
  1. Defaulted `isDemoMode` strictly to `false`.
  2. Removed automatic fallback to `DEMO_USER` on application mount.
  3. `signIn` now strictly executes `supabase.auth.signInWithPassword({ email, password })` and returns authentication errors directly.
  4. Explicitly resets `isDemoMode = false` on `signOut()`.
- **Mitigation Proof**: Playwright and Vitest tests in `tests/components/Auth.test.tsx` verify that incorrect passwords trigger an error alert and reject authentication.

### BUG-008: Unintended Demo Mode Activation on Credential Failure
- **Severity**: High (User Confusion & Security Isolation)
- **Problem**: Users entering an incorrect username or password were automatically transitioned into Demo Mode instead of seeing a credential error message.
- **Root Cause**: Shared session state in `AuthContext` coupled with the aforementioned fallback logic treated any failed or unauthenticated state as an implicit signal to activate demo capabilities.
- **Resolution**: Isolated Demo Mode strictly to explicit user action. Demo Mode is now only activated when the user deliberately clicks the **"Explore Sandbox Demo"** button on the login screen (`enableDemoMode()`). Any attempt to submit credentials through the Sign In or Sign Up forms is strictly validated against Supabase Auth.
- **Mitigation Proof**: Automated assertions verify that entering bad credentials keeps `user` as `null` and displays the Supabase error banner.

### BUG-009: Unbounded Data Rendering & Missing Viewport Pagination
- **Severity**: Medium (DOM Bloat & Mobile Layout Degradation)
- **Problem**: Monitored Endpoints, Execution History, Analytics Audit Summary, and Dashboard Recent Incident Alerts initially rendered unbounded lists or hardcoded slices (e.g. `.slice(0, 5)`). On devices with smaller screens (mobile / tablet), large execution logs caused heavy DOM node inflation, horizontal layout clipping, and sluggish interaction.
- **Resolution**:
  1. Introduced responsive client-side pagination via Material-UI `TablePagination` with configurable page sizes (`[5, 10, 25]` or `[10, 25, 50]`).
  2. Implemented dual-layout responsive rendering: stacked responsive cards for mobile viewports (`theme.breakpoints.down('md')`) and horizontally scrollable `<TableContainer sx={{ overflowX: 'auto' }}>` for desktop viewports.
  3. Wrapped pagination toolbars with `flexWrap: 'wrap'` and scaled font/icon sizes to eliminate horizontal overflow on mobile viewports ($320\text{px} - 390\text{px}$).
  4. Added pagination controls to Dashboard Overview ("Recent Incident Alerts"), Endpoints List, Execution History, and Analytics Audit Summary.
- **Mitigation Proof**: Tested across 320px–1280px viewports with zero horizontal scrolling regressions and verified by 11 unit tests in `Pagination.test.tsx`.
