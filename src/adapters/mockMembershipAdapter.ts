import { MembershipAdapter } from './membershipAdapter.js';
import { MembershipValidationResult, MembershipStatus } from '../types.js';

/**
 * In-memory adapter for tests and local development.
 * Seed it with known numbers and their expected statuses.
 */
export class MockMembershipAdapter implements MembershipAdapter {
  private members: Map<string, MembershipStatus>;

  constructor(seed: Record<string, MembershipStatus> = {}) {
    this.members = new Map(Object.entries(seed));
  }

  setMember(number: string, status: MembershipStatus): void {
    this.members.set(number.toUpperCase(), status);
  }

  async validate(membershipNumber: string): Promise<MembershipValidationResult> {
    const status = this.members.get(membershipNumber) ?? 'not_found';
    return { status, validatedAt: new Date() };
  }
}
