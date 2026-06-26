"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetsMembershipAdapter = void 0;
const googleapis_1 = require("googleapis");
/**
 * Reads a Google Sheet with the columns:
 *   A: MembershipNumber  B: Status  C: ExpiresDate (optional, ISO-8601)
 *
 * Status values expected in sheet: ACTIVE, INACTIVE, EXPIRED
 */
class SheetsMembershipAdapter {
    spreadsheetId;
    sheetName;
    serviceAccountEmail;
    privateKey;
    auth = null;
    constructor(spreadsheetId, sheetName, serviceAccountEmail, privateKey) {
        this.spreadsheetId = spreadsheetId;
        this.sheetName = sheetName;
        this.serviceAccountEmail = serviceAccountEmail;
        this.privateKey = privateKey;
    }
    getAuth() {
        if (!this.auth) {
            this.auth = new googleapis_1.google.auth.JWT({
                email: this.serviceAccountEmail,
                key: this.privateKey.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            });
        }
        return this.auth;
    }
    async validate(membershipNumber) {
        const now = new Date();
        try {
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.getAuth() });
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A2:C`,
            });
            const rows = response.data.values ?? [];
            for (const row of rows) {
                const sheetNumber = String(row[0] ?? '').trim().toUpperCase();
                if (sheetNumber !== membershipNumber)
                    continue;
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
        }
        catch (err) {
            return {
                status: 'error',
                message: `Sheets lookup failed: ${err.message}`,
                validatedAt: now,
            };
        }
    }
}
exports.SheetsMembershipAdapter = SheetsMembershipAdapter;
//# sourceMappingURL=sheetsMembershipAdapter.js.map