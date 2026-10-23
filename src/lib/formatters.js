import { format, formatDistanceToNow, parseISO } from 'date-fns';
export function formatDateTime(isoString) {
    if (!isoString)
        return 'Never';
    try {
        const date = parseISO(isoString);
        return format(date, 'MMM d, yyyy HH:mm:ss');
    }
    catch {
        return isoString;
    }
}
export function formatRelativeTime(isoString) {
    if (!isoString)
        return 'Never';
    try {
        const date = parseISO(isoString);
        return formatDistanceToNow(date, { addSuffix: true });
    }
    catch {
        return isoString;
    }
}
export function formatInterval(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins} min${mins > 1 ? 's' : ''}`;
    }
    const hours = Math.floor(seconds / 3600);
    const remainingMins = Math.floor((seconds % 3600) / 60);
    if (remainingMins === 0) {
        return `${hours} hr${hours > 1 ? 's' : ''}`;
    }
    return `${hours}h ${remainingMins}m`;
}
export function formatLatency(ms) {
    if (ms === null || ms === undefined)
        return '-';
    if (ms < 1000)
        return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
}
export function getStatusColor(statusCode, success) {
    if (!statusCode && !success)
        return 'error';
    if (statusCode && statusCode >= 200 && statusCode < 300)
        return 'success';
    if (statusCode && statusCode >= 300 && statusCode < 400)
        return 'warning';
    return 'error';
}
