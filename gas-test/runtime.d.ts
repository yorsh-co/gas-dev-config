/** Passed to every test registered with `test` and `info`. */
interface GasTestContext {
  /** Sheet-name prefix of this run; sheets created with it are deleted after the run. */
  readonly prefix: string;
  /** The test spreadsheet, resolved on first access. */
  readonly spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
}

/** Registers a test; it fails when `fn` throws. */
declare function test(
  name: string,
  fn: (context: GasTestContext) => void,
): void;

/**
 * Registers a check that records context-dependent behaviour. The returned
 * string, or the message it throws, is reported as INFO; it never fails the run.
 */
declare function info(
  name: string,
  fn: (context: GasTestContext) => string,
): void;

/** Throws an `Error` with `message` when `condition` is falsy. */
declare function assert(
  condition: unknown,
  message?: string,
): asserts condition;

/**
 * Runs every registered test. The spreadsheet is the argument, else the
 * `GAS_TEST_SPREADSHEET_ID` script property, else the active spreadsheet.
 *
 * @returns The results, base64-encoded between `@@GAS_TEST@@` and `@@END@@`.
 */
declare function runGasTests(spreadsheetId?: string): string;
