import { readFileSync } from 'node:fs';

export const source: number = readFileSync('package.json', 'utf8');
