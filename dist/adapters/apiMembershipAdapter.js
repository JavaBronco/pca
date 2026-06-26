"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiMembershipAdapter = void 0;
/**
 * Validates membership against an HTTP API.
 *
 * Expected GET /members/{membershipNumber}
 * Authorization: Bearer <PCA_API_KEY>
 * Response: { status, expiresAt?, message? }
 */
class ApiMembershipAdapter {
    baseUrl;
    apiKey;
    timeoutMs;
    constructor(baseUrl, apiKey, timeoutMs = 8000) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.timeoutMs = timeoutMs;
    }
    async validate(membershipNumber) {
        const now = new Date();
        const url = `${this.baseUrl}/members/${encodeURIComponent(membershipNumber)}`;
        let res;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    Accept: 'application/json',
                },
                signal: controller.signal,
            });
            clearTimeout(timer);
        }
        catch (err) {
            return {
                status: 'error',
                message: `API request failed: ${err.message}`,
                validatedAt: now,
            };
        }
        if (res.status === 404) {
            return { status: 'not_found', message: 'Member not found', validatedAt: now };
        }
        if (!res.ok) {
            return {
                status: 'error',
                message: `API returned HTTP ${res.status}`,
                validatedAt: now,
            };
        }
        let body;
        try {
            body = (await res.json());
        }
        catch {
            return { status: 'error', message: 'Invalid API response body', validatedAt: now };
        }
        if (body.status === 'ACTIVE') {
            if (body.expiresAt) {
                const expires = new Date(body.expiresAt);
                if (!isNaN(expires.getTime()) && expires < now) {
                    return { status: 'expired', message: `Expired on ${body.expiresAt}`, validatedAt: now };
                }
            }
            return { status: 'valid', validatedAt: now };
        }
        if (body.status === 'EXPIRED') {
            return { status: 'expired', message: body.message ?? 'Membership expired', validatedAt: now };
        }
        if (body.status === 'NOT_FOUND') {
            return { status: 'not_found', validatedAt: now };
        }
        return { status: 'invalid', message: body.message ?? 'Inactive membership', validatedAt: now };
    }
}
exports.ApiMembershipAdapter = ApiMembershipAdapter;
//# sourceMappingURL=apiMembershipAdapter.js.map