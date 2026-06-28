/**
 * Parses a CSV or plain-text file of PCA member numbers.
 *
 * Accepts two formats:
 *   1. Single column — one member number per line (no header)
 *      10001
 *      10002
 *
 *   2. CSV with a header row containing "MembershipNumber" or "MemberNumber"
 *      MembershipNumber,Name
 *      10001,John Smith
 *
 * Returns an array of normalized (trimmed, uppercased) member numbers.
 */
export declare function parseMemberFile(raw: string): string[];
/**
 * Replaces the Members sheet with a fresh list of active member numbers.
 * Clears all existing data rows then writes the new list.
 */
export declare function importMembersToSheet(memberNumbers: string[]): Promise<number>;
//# sourceMappingURL=memberImporter.d.ts.map