"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.AuditLogger = void 0;
const config_js_1 = require("../config.js");
const sheetsClient_js_1 = require("./sheetsClient.js");
/**
 * Writes audit entries to the Audit sheet.
 * Deliberately avoids logging PII (email, full membership number).
 * The submissionId is the correlation key for admin lookups.
 */
class AuditLogger {
    async log(entry) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID) {
            console.log('[AUDIT]', JSON.stringify(this.sanitize(entry)));
            return;
        }
        try {
            await (0, sheetsClient_js_1.appendRow)(cfg.SUBMISSIONS_SHEET_ID, cfg.AUDIT_SHEET_NAME, [
                entry.submissionId,
                entry.timestamp.toISOString(),
                entry.event,
                entry.membershipStatus ?? '',
                entry.discordMessageId ?? '',
                entry.error ? this.sanitizeError(entry.error) : '',
            ]);
        }
        catch (err) {
            // Never let logging failures silently swallow — emit to stderr but don't rethrow
            console.error('[AUDIT] Failed to write to sheet:', err.message);
        }
    }
    sanitize(entry) {
        return { ...entry, error: entry.error ? this.sanitizeError(entry.error) : undefined };
    }
    /** Strip anything that looks like an email or all-digit sequences (potential member IDs) */
    sanitizeError(msg) {
        return msg
            .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
            .replace(/\b\d{5,}\b/g, '[ID]');
    }
}
exports.AuditLogger = AuditLogger;
exports.auditLogger = new AuditLogger();
//# sourceMappingURL=auditLogger.js.map