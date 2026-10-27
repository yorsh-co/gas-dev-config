import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

describe('package', () => {
  it('is the gas-dev-config ESM package', () => {
    expect(pkg.name).toBe('gas-dev-config');
    expect(pkg.type).toBe('module');
  });
});
