export declare function appendRow(spreadsheetId: string, sheetName: string, values: (string | number | boolean)[]): Promise<void>;
export declare function getRows(spreadsheetId: string, sheetName: string, range?: string): Promise<string[][]>;
export declare function updateCell(spreadsheetId: string, sheetName: string, row: number, col: number, value: string): Promise<void>;
//# sourceMappingURL=sheetsClient.d.ts.map