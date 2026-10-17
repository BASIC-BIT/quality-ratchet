import { scanContext, write } from "./repo.mjs";
import { scanDuplication } from "../../src/duplication/scanner.mjs";
import { scanComplexity } from "../../src/scanners/complexity.mjs";
import { scanFileSize } from "../../src/scanners/file-size.mjs";
import { body } from "../fixtures/duplication/bodies.mjs";
import { heavy } from "../fixtures/functions/bodies.mjs";
export function runContext(repo, input = {}) {
  const context = scanContext(repo, input);
  return {
    comparison: context.comparison,
    toolRoot: context.toolRoot,
    selection: {
      active: context.policy,
      proposed: context.policy,
      configCommit: context.comparison.baselineSha,
      changed: false,
      diff: [],
    },
  };
}
export async function measuredResults(context) {
  const scan = { ...context, policy: context.selection.active };
  const results = [];
  for (const [name, measure] of [
    ["duplication", scanDuplication],
    ["complexity", scanComplexity],
    ["file-size", scanFileSize],
  ]) {
    const report = await measure(scan);
    results.push({
      name,
      state: "scanned",
      exitCode: report.findings.length ? 1 : 0,
      report,
      error: null,
    });
  }
  return results;
}
export function regressionSources(repo) {
  write(repo, "test/one.ts", body("one"));
  write(repo, "test/two.ts", body("two"));
  write(repo, "test/heavy.ts", heavy("heavy", 16));
}
export const rawResult = (report, status = 0) => ({
  status,
  signal: null,
  stdout: JSON.stringify(report),
  stderr: "",
});
