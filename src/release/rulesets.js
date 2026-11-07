// @ts-check
import { spawnSync } from 'node:child_process';
import { ReleaseError } from './errors.js';

/** Rule types every release branch must carry. */
const BRANCH_RULES = ['deletion', 'non_fast_forward'];

/** Rule types the tag ruleset must carry. */
const TAG_RULES = ['deletion', 'non_fast_forward', 'update'];

/**
 * Calls `gh api` and parses the JSON response.
 *
 * @param {string} path API path.
 * @param {string} cwd Project root.
 * @returns {any}
 * @throws {ReleaseError} When gh is missing, fails or prints something other than JSON.
 */
function ghApi(path, cwd) {
  const result = spawnSync('gh', ['api', path], { cwd, encoding: 'utf8' });
  if (result.error) {
    const { code } = /** @type {NodeJS.ErrnoException} */ (result.error);
    if (code === 'ENOENT') {
      throw new ReleaseError(
        'gh is not installed — install GitHub CLI or set githubRelease to false.',
      );
    }
    throw new ReleaseError(`gh failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new ReleaseError(
      `gh api ${path} failed: ${(result.stderr ?? '').trim()}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new ReleaseError(
      `gh api ${path} returned unexpected output: ${result.stdout.trim()}`,
    );
  }
}

/**
 * Finds the rule types a branch lacks, counting repository and organization rulesets.
 *
 * @param {string} repo `owner/repo`.
 * @param {string} branch Branch name.
 * @param {string} cwd Project root.
 * @returns {string[]} Missing rule types.
 */
function missingBranchRules(repo, branch, cwd) {
  const encoded = branch.split('/').map(encodeURIComponent).join('/');
  const rules = ghApi(
    `repos/${repo}/rules/branches/${encoded}?per_page=100`,
    cwd,
  );
  const present = new Set(
    (Array.isArray(rules) ? rules : []).map(
      (/** @type {{ type?: string }} */ rule) => rule.type,
    ),
  );
  return BRANCH_RULES.filter((type) => !present.has(type));
}

/**
 * Describes the tag protection gap, if any.
 *
 * @param {string} repo `owner/repo`.
 * @param {string} cwd Project root.
 * @returns {string | undefined} The gap, or undefined when the tags are protected.
 */
function tagGap(repo, cwd) {
  const list = ghApi(`repos/${repo}/rulesets?per_page=100`, cwd);
  const active = (Array.isArray(list) ? list : []).filter(
    (/** @type {{ target?: string, enforcement?: string }} */ r) =>
      r.target === 'tag' && r.enforcement === 'active',
  );
  if (active.length === 0) return 'tags: no active tag ruleset';
  const covered = active.some((/** @type {{ id: number }} */ { id }) => {
    const ruleset = ghApi(`repos/${repo}/rulesets/${id}`, cwd);
    const refName = ruleset?.conditions?.ref_name;
    const types = new Set(
      (Array.isArray(ruleset?.rules) ? ruleset.rules : []).map(
        (/** @type {{ type?: string }} */ rule) => rule.type,
      ),
    );
    return (
      Array.isArray(refName?.include) &&
      refName.include.includes('~ALL') &&
      (refName.exclude ?? []).length === 0 &&
      TAG_RULES.every((type) => types.has(type))
    );
  });
  return covered
    ? undefined
    : 'tags: no active ruleset on ~ALL with deletion, non_fast_forward and update';
}

/**
 * Refuses to release unless GitHub rulesets protect every target branch and the release tags.
 * Checks minimum protection only; bypass actors and other tag patterns are not evaluated.
 *
 * @param {string} repo `owner/repo`.
 * @param {import('./config.js').Target[]} targets Release targets.
 * @param {string} cwd Project root.
 * @throws {ReleaseError} Listing every gap, or when gh fails.
 */
export function assertProtected(repo, targets, cwd) {
  /** @type {string[]} */
  const gaps = [];
  for (const { branch } of targets) {
    const missing = missingBranchRules(repo, branch, cwd);
    if (missing.length > 0)
      gaps.push(`${branch}: missing ${missing.join(', ')}`);
  }
  const tags = tagGap(repo, cwd);
  if (tags) gaps.push(tags);
  if (gaps.length > 0) {
    throw new ReleaseError(
      `Rulesets do not protect the release: ${gaps.join('; ')}.\n` +
        'Run `npx gas-dev-config github --fix` (needs admin rights) to apply the gas-* rulesets.',
    );
  }
}
