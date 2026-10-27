import { readFileSync } from 'node:fs';

/** @type {string} */
export const source = readFileSync('package.json', 'utf8');
