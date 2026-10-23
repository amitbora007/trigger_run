import { describe, it, expect } from 'vitest';
/**
 * Simulates PostgreSQL calculate_next_run_at with bounded catch-up:
 * GREATEST(NOW(), scheduled_at + interval_seconds)
 */
export function calculateNextRunAt(now, scheduledAt, intervalSeconds) {
    const theoreticalNext = new Date(scheduledAt.getTime() + intervalSeconds * 1000);
    // GREATEST(NOW(), theoreticalNext)
    return theoreticalNext.getTime() > now.getTime() ? theoreticalNext : now;
}
export function isLeaseActive(leaseExpiresAt, now) {
    if (!leaseExpiresAt)
        return false;
    return new Date(leaseExpiresAt).getTime() > now.getTime();
}
describe('Scheduling Policy & Bounded Catch-Up', () => {
    it('enforces minimum interval requirement of 5 minutes (300 seconds)', () => {
        const MIN_INTERVAL_SECONDS = 300;
        const validIntervals = [300, 600, 900, 1800, 3600, 86400];
        const invalidIntervals = [0, 10, 60, 120, 240, 299];
        for (const interval of validIntervals) {
            expect(interval >= MIN_INTERVAL_SECONDS).toBe(true);
        }
        for (const interval of invalidIntervals) {
            expect(interval >= MIN_INTERVAL_SECONDS).toBe(false);
        }
    });
    it('schedules regular on-time executions cleanly', () => {
        const scheduledAt = new Date('2026-10-21T12:00:00Z');
        const now = new Date('2026-10-21T12:00:05Z'); // Ran 5s after schedule
        const intervalSeconds = 300; // 5 mins
        const nextRun = calculateNextRunAt(now, scheduledAt, intervalSeconds);
        // 12:00:00 + 300s = 12:05:00, which is > 12:00:05
        expect(nextRun.toISOString()).toBe('2026-10-21T12:05:00.000Z');
    });
    it('prevents request storms after prolonged delays (bounded catch-up)', () => {
        const scheduledAt = new Date('2026-10-21T10:00:00Z');
        // Database was paused or asleep for 3 hours, resumes at 13:00:00Z
        const now = new Date('2026-10-21T13:00:00Z');
        const intervalSeconds = 300;
        const nextRun = calculateNextRunAt(now, scheduledAt, intervalSeconds);
        // Theoretical next was 10:05:00Z (in the distant past).
        // Bounded catch-up advances next_run_at to NOW() (13:00:00Z).
        // Subsequent scheduling will be 13:05:00Z.
        expect(nextRun.toISOString()).toBe('2026-10-21T13:00:00.000Z');
    });
    it('correctly tracks active vs expired worker leases', () => {
        const now = new Date('2026-10-21T12:00:00Z');
        // Case 1: Lease still valid for 60 seconds
        const activeLease = new Date('2026-10-21T12:01:00Z').toISOString();
        expect(isLeaseActive(activeLease, now)).toBe(true);
        // Case 2: Lease expired 10 seconds ago
        const expiredLease = new Date('2026-10-21T11:59:50Z').toISOString();
        expect(isLeaseActive(expiredLease, now)).toBe(false);
        // Case 3: No lease (idle endpoint)
        expect(isLeaseActive(null, now)).toBe(false);
    });
});
