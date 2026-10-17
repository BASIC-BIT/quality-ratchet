// Generic diagnostic classification adapted from Perkcord; see docs/provenance.md.
import { isJsTsPath, matchesScope } from "../config/resolve.mjs";
const TEST_RE =
  /(\.test\.|\.spec\.|\.stories\.|\/(?:tests?|test-utils|__tests__|e2e|fixtures?)\/|\/[^/]*fixtures?\.[^/]+$)/iu;
export const isTestPath = (path) => TEST_RE.test(`/${path}`);
export const isTestSourcePath = (path) => isJsTsPath(path) && isTestPath(path);
export function reportSourceSelected(policy, path) {
  return (
    isTestSourcePath(path) &&
    ((policy.reports.testSize.enabled &&
      matchesScope(policy, "file-size", path)) ||
      (policy.reports.testDebt && matchesScope(policy, "duplication", path)))
  );
}
export const comparePaths = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
