import { describe, it, expect } from 'vitest';
import { validateUrlForSSRF, parseAndNormalizeIPv4, isForbiddenIPv4, isForbiddenIPv6, } from '../../supabase/functions/_shared/ssrf';
describe('SSRF Defense Engine', () => {
    describe('IPv4 Address Parsing and Normalization', () => {
        it('normalizes standard dotted-decimal IPv4', () => {
            expect(parseAndNormalizeIPv4('127.0.0.1')).toBe('127.0.0.1');
            expect(parseAndNormalizeIPv4('192.168.1.10')).toBe('192.168.1.10');
            expect(parseAndNormalizeIPv4('169.254.169.254')).toBe('169.254.169.254');
        });
        it('decodes single integer DWORD obfuscated representations', () => {
            // 2130706433 is 127.0.0.1 in decimal integer
            expect(parseAndNormalizeIPv4('2130706433')).toBe('127.0.0.1');
            // 2852039166 is 169.254.169.254
            expect(parseAndNormalizeIPv4('2852039166')).toBe('169.254.169.254');
        });
        it('decodes hexadecimal obfuscated representations', () => {
            expect(parseAndNormalizeIPv4('0x7f000001')).toBe('127.0.0.1');
            expect(parseAndNormalizeIPv4('0x7f.0.0.1')).toBe('127.0.0.1');
        });
        it('decodes octal obfuscated representations', () => {
            expect(parseAndNormalizeIPv4('0177.0.0.1')).toBe('127.0.0.1');
        });
    });
    describe('Forbidden IPv4 CIDR Validation', () => {
        it('blocks loopback 127.0.0.0/8', () => {
            expect(isForbiddenIPv4('127.0.0.1').forbidden).toBe(true);
            expect(isForbiddenIPv4('127.255.255.254').forbidden).toBe(true);
        });
        it('blocks AWS/GCP/Azure link-local cloud metadata (169.254.169.254)', () => {
            expect(isForbiddenIPv4('169.254.169.254').forbidden).toBe(true);
            expect(isForbiddenIPv4('169.254.1.1').forbidden).toBe(true);
        });
        it('blocks RFC 1918 private subnets', () => {
            expect(isForbiddenIPv4('10.0.0.1').forbidden).toBe(true);
            expect(isForbiddenIPv4('10.254.254.254').forbidden).toBe(true);
            expect(isForbiddenIPv4('172.16.0.1').forbidden).toBe(true);
            expect(isForbiddenIPv4('172.31.255.255').forbidden).toBe(true);
            expect(isForbiddenIPv4('192.168.1.1').forbidden).toBe(true);
            expect(isForbiddenIPv4('192.168.100.50').forbidden).toBe(true);
        });
        it('blocks 0.0.0.0, broadcast, and multicast', () => {
            expect(isForbiddenIPv4('0.0.0.0').forbidden).toBe(true);
            expect(isForbiddenIPv4('224.0.0.1').forbidden).toBe(true);
            expect(isForbiddenIPv4('255.255.255.255').forbidden).toBe(true);
        });
        it('permits valid public IPv4 addresses', () => {
            expect(isForbiddenIPv4('8.8.8.8').forbidden).toBe(false);
            expect(isForbiddenIPv4('1.1.1.1').forbidden).toBe(false);
            expect(isForbiddenIPv4('93.184.216.34').forbidden).toBe(false); // example.com
        });
    });
    describe('Forbidden IPv6 Validation', () => {
        it('blocks IPv6 loopback (::1)', () => {
            expect(isForbiddenIPv6('::1').forbidden).toBe(true);
            expect(isForbiddenIPv6('[::1]').forbidden).toBe(true);
        });
        it('blocks IPv6 Link-Local (fe80::/10)', () => {
            expect(isForbiddenIPv6('fe80::1').forbidden).toBe(true);
        });
        it('blocks IPv6 Unique Local Address ULA (fc00::/7)', () => {
            expect(isForbiddenIPv6('fc00::1').forbidden).toBe(true);
            expect(isForbiddenIPv6('fd12:3456:789a::1').forbidden).toBe(true);
        });
        it('blocks IPv4-mapped IPv6 pointing to loopback or private range', () => {
            expect(isForbiddenIPv6('::ffff:127.0.0.1').forbidden).toBe(true);
            expect(isForbiddenIPv6('::ffff:169.254.169.254').forbidden).toBe(true);
            expect(isForbiddenIPv6('::ffff:10.0.0.1').forbidden).toBe(true);
        });
    });
    describe('Comprehensive validateUrlForSSRF', () => {
        it('blocks non-HTTP protocols', () => {
            expect(validateUrlForSSRF('file:///etc/passwd').isValid).toBe(false);
            expect(validateUrlForSSRF('gopher://127.0.0.1:70/').isValid).toBe(false);
            expect(validateUrlForSSRF('ftp://example.com/').isValid).toBe(false);
            expect(validateUrlForSSRF('ssh://user@example.com').isValid).toBe(false);
        });
        it('blocks dangerous internal service ports', () => {
            expect(validateUrlForSSRF('http://example.com:22').isValid).toBe(false);
            expect(validateUrlForSSRF('http://example.com:5432').isValid).toBe(false);
            expect(validateUrlForSSRF('http://example.com:6379').isValid).toBe(false);
            expect(validateUrlForSSRF('http://example.com:2375').isValid).toBe(false);
        });
        it('allows standard web ports 80, 443, 8080, 8443', () => {
            expect(validateUrlForSSRF('http://example.com:80').isValid).toBe(true);
            expect(validateUrlForSSRF('https://example.com:443').isValid).toBe(true);
            expect(validateUrlForSSRF('http://example.com:8080').isValid).toBe(true);
            expect(validateUrlForSSRF('https://example.com:8443').isValid).toBe(true);
        });
        it('blocks localhost domain variations', () => {
            expect(validateUrlForSSRF('http://localhost').isValid).toBe(false);
            expect(validateUrlForSSRF('http://localhost:8080/test').isValid).toBe(false);
            expect(validateUrlForSSRF('http://sub.localhost').isValid).toBe(false);
            expect(validateUrlForSSRF('http://app.internal').isValid).toBe(false);
            expect(validateUrlForSSRF('http://service.local').isValid).toBe(false);
        });
        it('blocks metadata URL exploits', () => {
            expect(validateUrlForSSRF('http://169.254.169.254/latest/meta-data/').isValid).toBe(false);
            expect(validateUrlForSSRF('http://2852039166/latest/meta-data/').isValid).toBe(false);
        });
        it('permits valid public HTTPS targets', () => {
            const valid = validateUrlForSSRF('https://httpbin.org/get?test=1');
            expect(valid.isValid).toBe(true);
            expect(valid.normalizedUrl).toContain('https://httpbin.org/get?test=1');
        });
    });
});
