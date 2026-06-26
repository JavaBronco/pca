import { AuditEntry } from '../types.js';
/**
 * Writes audit entries to the Audit sheet.
 * Deliberately avoids logging PII (email, full membership number).
 * The submissionId is the correlation key for admin lookups.
 */
export declare class AuditLogger {
    log(entry: AuditEntry): Promise<void>;
    private sanitize;
    /** Strip anything that looks like an email or all-digit sequences (potential member IDs) */
    private sanitizeError;
}
export declare const auditLogger: AuditLogger;
//# sourceMappingURL=auditLogger.d.ts.map