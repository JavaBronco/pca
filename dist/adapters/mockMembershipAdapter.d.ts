import { MembershipAdapter } from './membershipAdapter.js';
import { MembershipValidationResult, MembershipStatus } from '../types.js';
/**
 * In-memory adapter for tests and local development.
 * Seed it with known numbers and their expected statuses.
 */
export declare class MockMembershipAdapter implements MembershipAdapter {
    private members;
    constructor(seed?: Record<string, MembershipStatus>);
    setMember(number: string, status: MembershipStatus): void;
    validate(membershipNumber: string): Promise<MembershipValidationResult>;
}
//# sourceMappingURL=mockMembershipAdapter.d.ts.map