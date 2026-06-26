"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendRow = appendRow;
exports.getRows = getRows;
exports.updateCell = updateCell;
const googleapis_1 = require("googleapis");
const config_js_1 = require("../config.js");
let _sheets = null;
function getSheetsClient() {
    if (_sheets)
        return _sheets;
    const cfg = (0, config_js_1.getConfig)();
    const auth = new googleapis_1.google.auth.JWT({
        email: cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (cfg.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    _sheets = googleapis_1.google.sheets({ version: 'v4', auth });
    return _sheets;
}
async function appendRow(spreadsheetId, sheetName, values) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
    });
}
async function getRows(spreadsheetId, sheetName, range = 'A2:Z') {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!${range}`,
    });
    return (res.data.values ?? []);
}
async function updateCell(spreadsheetId, sheetName, row, col, value) {
    const colLetter = String.fromCharCode(64 + col);
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${colLetter}${row}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
    });
}
//# sourceMappingURL=sheetsClient.js.map