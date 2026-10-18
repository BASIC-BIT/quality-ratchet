// Adapted from immutable consumer file-size gates; terms in docs/provenance.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { effectiveCheck } from "../config/resolve.mjs";
import { scannerScope } from "./scope.mjs";
import { withSourceSnapshot } from "../git/snapshot.mjs";
import { runScannerEntry } from "./entry.mjs";

/** Physical lines: a trailing newline does not start a new line. Also used by test-size reports. */
export function physicalLines(text) {
  if (text.length === 0) return 0;
  const count = text.split(/\r\n|\r|\n/u).length;
  return /(?:\r\n|\r|\n)$/u.test(text) ? count - 1 : count;
}
export function classify(file, lines, baseLines, cap = 1000) {
  if (lines < cap) return null;
  if (baseLines === null)
    return { file, lines, baseLines: null, verdict: "NEW" };
  if (lines > baseLines) return { file, lines, baseLines, verdict: "GREW" };
  return null;
}
export async function scanFileSize(context) {
  const { comparison, policy } = context;
  return withSourceSnapshot(context, async (snapshot) => {
    const { files, baseline, metadata } = scannerScope(
      context,
      snapshot,
      "file-size",
    );
    const findings = [];
    for (const file of files) {
      const check = effectiveCheck(policy, "file-size", file);
      const basePath = comparison.renames.get(file) ?? file;
      const lines = physicalLines(
        readFileSync(join(snapshot.current, file), "utf8"),
      );
      const baseLines = baseline.has(basePath)
        ? physicalLines(readFileSync(join(snapshot.base, basePath), "utf8"))
        : null;
      const finding = classify(
        file,
        lines,
        baseLines,
        check.thresholds.maxLines,
      );
      if (finding) findings.push({ ...finding, ...check });
    }
    return {
      ...metadata,
      findings: findings.sort((a, b) => b.lines - a.lines),
    };
  });
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await runScannerEntry("file-size", scanFileSize);
