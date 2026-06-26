import { MembershipValidationResult } from '../types.js';

export interface MembershipAdapter {
  /**
   * Validate a normalized PCA membership number.
   * Returns one of: valid, invalid, expired, not_found, error.
   */
  validate(normalizedMembershipNumber: string): Promise<MembershipValidationResult>;
  /** Optional cleanup (close DB connections, etc.) */
  close?(): Promise<void>;
}
