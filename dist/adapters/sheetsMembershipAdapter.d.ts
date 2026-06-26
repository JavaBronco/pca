import { MembershipAdapter } from './membershipAdapter.js';
import { MembershipValidationResult } from '../types.js';
/**
 * Reads a Google Sheet with the columns:
 *   A: MembershipNumber  B: Status  C: ExpiresDate (optional, ISO-8601)
 *
 * Status values expected in sheet: ACTIVE, INACTIVE, EXPIRED
 */
export declare class SheetsMembershipAdapter implements MembershipAdapter {
    private readonly spreadsheetId;
    private readonly sheetName;
    private readonly serviceAccountEmail;
    private readonly privateKey;
    private auth;
    constructor(spreadsheetId: string, sheetName: string, serviceAccountEmail: string, privateKey: string);
    private getAuth;
    validate(membershipNumber: string): Promise<MembershipValidationResult>;
}
//# sourceMappingURL=sheetsMembershipAdapter.d.ts.map