import { google, sheets_v4 } from 'googleapis';
import { getConfig } from '../config.js';

let _sheets: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets;
  const cfg = getConfig();
  const auth = new google.auth.JWT({
    email: cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (cfg.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | boolean)[],
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

export async function getRows(
  spreadsheetId: string,
  sheetName: string,
  range = 'A2:Z',
): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${range}`,
  });
  return (res.data.values ?? []) as string[][];
}

export async function updateCell(
  spreadsheetId: string,
  sheetName: string,
  row: number,
  col: number,
  value: string,
): Promise<void> {
  const colLetter = String.fromCharCode(64 + col);
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${colLetter}${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}
