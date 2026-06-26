import { google } from 'googleapis';
import { MembershipAdapter } from './membershipAdapter.js';
import { MembershipValidationResult } from '../types.js';

/**
 * Reads a Google Sheet with the columns:
 *   A: MembershipNumber  B: Status  C: ExpiresDate (optional, ISO-8601)
 *
 * Status values expected in sheet: ACTIVE, INACTIVE, EXPIRED
 */
export class SheetsMembershipAdapter implements MembershipAdapter {
  private auth: InstanceType<typeof google.auth.JWT> | null = null;

  constructor(
    private readonly spreadsheetId: string,
    private readonly sheetName: string,
    private readonly serviceAccountEmail: string,
    private readonly privateKey: string,
  ) {}

  private getAuth() {
    if (!this.auth) {
      this.auth = new google.auth.JWT({
        email: this.serviceAccountEmail,
        key: this.privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }
    return this.auth;
  }

  async validate(membershipNumber: string): Promise<MembershipValidationResult> {
    const now = new Date();
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.getAuth() });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A2:C`,
      });

      const rows = response.data.values ?? [];
      for (const row of rows) {
        const sheetNumber = String(row[0] ?? '').trim().toUpperCase();
        if (sheetNumber !== membershipNumber) continue;

        const status = String(row[1] ?? '').trim().toUpperCase();
        const expiresRaw = row[2] ? String(row[2]).trim() : null;

        if (status === 'ACTIVE') {
          if (expiresRaw) {
            const expires = new Date(expiresRaw);
            if (!isNaN(expires.getTime()) && expires < now) {
              return { status: 'expired', message: `Expired on ${expiresRaw}`, validatedAt: now };
            }
          }
          return { status: 'valid', validatedAt: now };
        }

        if (status === 'EXPIRED') {
          return { status: 'expired', message: 'Membership is expired', validatedAt: now };
        }

        return { status: 'invalid', message: `Status: ${status}`, validatedAt: now };
      }

      return { status: 'not_found', message: 'Membership number not in records', validatedAt: now };
    } catch (err) {
      return {
        status: 'error',
        message: `Sheets lookup failed: ${(err as Error).message}`,
        validatedAt: now,
      };
    }
  }
}
