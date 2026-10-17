// Adapted from generic Perkcord test-debt reporting; see docs/provenance.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSourceSnapshot } from "../git/snapshot.mjs";
import { matchesScope } from "../config/resolve.mjs";
import { physicalLines } from "../scanners/file-size.mjs";
import { isTestSourcePath, comparePaths } from "./scope.mjs";
export function summarizeTestSources(entries, oversizedLines) {
  const ordered = [...entries].sort((a, b) => comparePaths(a.path, b.path));
  return {
    files: ordered.length,
    lines: ordered.reduce((sum, file) => sum + file.lines, 0),
    oversizedLines,
    oversizedFiles: ordered
      .filter((file) => file.lines >= oversizedLines)
      .sort((a, b) => b.lines - a.lines || comparePaths(a.path, b.path)),
    entries: ordered,
  };
}
/** Each enabled view keeps its scanner's scope, even when its ratchet is off. */
export function collectTestSourceInventory(context) {
  if (
    !context.policy.reports.testSize.enabled &&
    !context.policy.reports.testDebt
  )
    return { testSize: null, testDebt: null };
  const snapshot = createSourceSnapshot(context);
  try {
    const files = snapshot.paths.current
      .filter(isTestSourcePath)
      .map((path) => ({
        path,
        lines: physicalLines(
          readFileSync(join(snapshot.current, path), "utf8"),
        ),
      }));
    const { policy } = context;
    const summarize = (gate) =>
      summarizeTestSources(
        files.filter((file) => matchesScope(policy, gate, file.path)),
        policy.reports.testSize.oversizedLines,
      );
    return {
      testSize: policy.reports.testSize.enabled ? summarize("file-size") : null,
      testDebt: policy.reports.testDebt ? summarize("duplication") : null,
    };
  } finally {
    snapshot.dispose();
  }
}
