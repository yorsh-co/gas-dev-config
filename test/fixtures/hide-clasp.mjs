import { registerHooks } from 'node:module';

/**
 * Preloaded with `--import` to make `@google/clasp` unresolvable, for both `import` and
 * `require.resolve`, so the missing-clasp path can be exercised in a spawned process.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@google/clasp' || specifier.startsWith('@google/clasp/')) {
      throw Object.assign(new Error(`Cannot find package '${specifier}'`), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
    }
    return nextResolve(specifier, context);
  },
});
