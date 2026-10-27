export interface GasLoaderOptions {
  /** Source files in load order, resolved against `root`. */
  files: string[];
  /** Names of the global declarations to return. */
  exports: string[];
  /** Directory the files are resolved against; defaults to `process.cwd()`. */
  root?: string;
}

/**
 * Creates a loader for Google Apps Script sources. The files are transpiled
 * once; each call of the returned function evaluates them in a fresh
 * `node:vm` context built from a shallow copy of `globals`.
 *
 * `T` is the shape of the exported globals, supplied by the caller.
 */
export function createGasLoader<T extends object = Record<string, unknown>>(
  options: GasLoaderOptions,
): (globals?: Record<string, unknown>) => T;
