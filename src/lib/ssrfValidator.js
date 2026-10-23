/**
 * Client-Side SSRF Validation & Preview Helper
 * Provides immediate feedback in forms before submitting to backend.
 */
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);
export function validateClientUrl(rawUrl) {
    if (!rawUrl || !rawUrl.trim()) {
        return { isValid: false, message: 'URL is required' };
    }
    let parsed;
    try {
        parsed = new URL(rawUrl.trim());
    }
    catch {
        return { isValid: false, message: 'Invalid URL format (e.g. https://api.example.com/health)' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { isValid: false, message: 'Only HTTP and HTTPS protocols are permitted' };
    }
    const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
    if (!ALLOWED_PORTS.has(port)) {
        return { isValid: false, message: `Port ${port} is restricted. Only ports 80, 443, 8080, 8443 are allowed.` };
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host === '0.0.0.0') {
        return { isValid: false, message: 'Localhost and internal domain destinations are prohibited' };
    }
    // Check IPv4 matches
    if (/^127\./.test(host)) {
        return { isValid: false, message: 'Loopback 127.0.0.0/8 addresses are prohibited' };
    }
    if (/^10\./.test(host)) {
        return { isValid: false, message: 'Private RFC 1918 (10.0.0.0/8) addresses are prohibited' };
    }
    if (/^192\.168\./.test(host)) {
        return { isValid: false, message: 'Private RFC 1918 (192.168.0.0/16) addresses are prohibited' };
    }
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
        return { isValid: false, message: 'Private RFC 1918 (172.16.0.0/12) addresses are prohibited' };
    }
    if (/^169\.254\./.test(host)) {
        return { isValid: false, message: 'Cloud instance metadata (169.254.0.0/16) is strictly prohibited' };
    }
    // Check IPv6 loopback
    if (host === '[::1]' || host === '::1') {
        return { isValid: false, message: 'IPv6 loopback address is prohibited' };
    }
    return { isValid: true };
}
