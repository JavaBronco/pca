import { AuditEntry } from '../types.js';
import { getConfig } from '../config.js';
import { appendRow } from './sheetsClient.js';

/**
 * Writes audit entries to the Audit sheet.
 * Deliberately avoids logging PII (email, full membership number).
 * The submissionId is the correlation key for admin lookups.
 */
export class AuditLogger {
  async log(entry: AuditEntry): Promise<void> {
    const cfg = getConfig();
    if (!cfg.SUBMISSIONS_SHEET_ID) {
      console.log('[AUDIT]', JSON.stringify(this.sanitize(entry)));
      return;
    }
    try {
      await appendRow(cfg.SUBMISSIONS_SHEET_ID, cfg.AUDIT_SHEET_NAME, [
        entry.submissionId,
        entry.timestamp.toISOString(),
        entry.event,
        entry.membershipStatus ?? '',
        entry.discordMessageId ?? '',
        entry.error ? this.sanitizeError(entry.error) : '',
      ]);
    } catch (err) {
      // Never let logging failures silently swallow — emit to stderr but don't rethrow
      console.error('[AUDIT] Failed to write to sheet:', (err as Error).message);
    }
  }

  private sanitize(entry: AuditEntry): Omit<AuditEntry, 'error'> & { error?: string } {
    return { ...entry, error: entry.error ? this.sanitizeError(entry.error) : undefined };
  }

  /** Strip anything that looks like an email or all-digit sequences (potential member IDs) */
  private sanitizeError(msg: string): string {
    return msg
      .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{5,}\b/g, '[ID]');
  }
}

export const auditLogger = new AuditLogger();
