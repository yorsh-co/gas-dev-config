// @ts-check

/** An expected failure; its message is shown to the user without a stack trace. */
export class ReleaseError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'ReleaseError';
  }
}

/**
 * The release was pushed, but publishing the GitHub Release failed.
 * Exits with code 3 so CI can tell it apart from a release that never happened.
 */
export class GitHubReleaseError extends ReleaseError {
  /**
   * Process exit code for this failure.
   *
   * @readonly
   */
  exitCode = 3;

  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'GitHubReleaseError';
  }
}
