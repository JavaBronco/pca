"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMemberFile = parseMemberFile;
exports.importMembersToSheet = importMembersToSheet;
const googleapis_1 = require("googleapis");
const config_js_1 = require("../config.js");
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
function parseMemberFile(raw) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0)
        return [];
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('membershipnumber') ||
        firstLine.includes('membernumber') ||
        firstLine.includes('membership_number') ||
        firstLine.includes('member_number') ||
        firstLine.startsWith('number');
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const members = [];
    for (const line of dataLines) {
        // Take only the first column if CSV
        const first = line.split(',')[0].trim().toUpperCase();
        if (first)
            members.push(first);
    }
    return members;
}
/**
 * Replaces the Members sheet with a fresh list of active member numbers.
 * Clears all existing data rows then writes the new list.
 */
async function importMembersToSheet(memberNumbers) {
    const cfg = (0, config_js_1.getConfig)();
    if (!cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL || !cfg.GOOGLE_PRIVATE_KEY || !cfg.MEMBERS_SHEET_ID) {
        throw new Error('Google Sheets credentials not configured');
    }
    const auth = new googleapis_1.google.auth.JWT({
        email: cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: cfg.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
    const spreadsheetId = cfg.MEMBERS_SHEET_ID;
    const sheetName = cfg.MEMBERS_SHEET_NAME;
    // Clear everything below the header row
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A2:C`,
    });
    if (memberNumbers.length === 0)
        return 0;
    // Write all active members
    const rows = memberNumbers.map((num) => [num, 'ACTIVE', '']);
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: 'RAW',
        requestBody: { values: rows },
    });
    return memberNumbers.length;
}
//# sourceMappingURL=memberImporter.js.map