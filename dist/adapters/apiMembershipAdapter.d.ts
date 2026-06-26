import { MembershipAdapter } from './membershipAdapter.js';
import { MembershipValidationResult } from '../types.js';
/**
 * Validates membership against an HTTP API.
 *
 * Expected GET /members/{membershipNumber}
 * Authorization: Bearer <PCA_API_KEY>
 * Response: { status, expiresAt?, message? }
 */
export declare class ApiMembershipAdapter implements MembershipAdapter {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly timeoutMs;
    constructor(baseUrl: string, apiKey: string, timeoutMs?: number);
    validate(membershipNumber: string): Promise<MembershipValidationResult>;
}
//# sourceMappingURL=apiMembershipAdapter.d.ts.map