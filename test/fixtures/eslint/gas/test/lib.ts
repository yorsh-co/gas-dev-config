import { readFileSync } from 'node:fs';

export const size = readFileSync(import.meta.url).length;
