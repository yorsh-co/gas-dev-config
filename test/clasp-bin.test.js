import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveClaspBin } from '../src/clasp-bin.js';

describe('resolveClaspBin', () => {
  it('returns the installed clasp entry script', () => {
    const bin = resolveClaspBin();
    expect(existsSync(bin)).toBe(true);
    expect(bin.endsWith(join('build', 'src', 'index.js'))).toBe(true);
  });

  it('throws a plain Error when clasp cannot be resolved', () => {
    expect(() => resolveClaspBin(join(tmpdir(), 'nowhere.js'))).toThrow(
      'Could not resolve the @google/clasp bin',
    );
  });
});
