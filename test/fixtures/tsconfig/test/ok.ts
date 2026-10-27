import { readFileSync } from 'node:fs';

export const source = readFileSync('package.json', 'utf8');
export const sheet = SpreadsheetApp.getActiveSpreadsheet();
