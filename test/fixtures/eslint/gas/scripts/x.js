import { readFileSync } from 'node:fs';

export const text = readFileSync(import.meta.filename, 'utf8');
