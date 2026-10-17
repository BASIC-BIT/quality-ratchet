// Rationale parser adapted from Chronote; see docs/provenance.md.
import { validatePolicyReport } from "../report.mjs";
import { shaPattern, validRef } from "./client.mjs";
function nextFence(line, current) {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return current;
  if (!current) return match[1];
  return match[1][0] === current[0] &&
    match[1].length >= current.length &&
    !match[2].trim()
    ? null
    : current;
}
export function extractRationale(body) {
  const lines = body.replace(/<!--[\s\S]*?(?:-->|$)/g, "").split(/\r?\n/);
  let fence = null,
    paragraph = null,
    start = null,
    end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const before = fence;
    fence = nextFence(lines[i], fence);
    if (before || fence) {
      paragraph = null;
      continue;
    }
    if (start === null && lines[i].trimEnd() === "## Quality exception") {
      start = i + 1;
      paragraph = null;
      continue;
    }
    if (start !== null && /^ {0,3}#{1,2}(?:[ \t]|$)/.test(lines[i])) {
      end = i;
      break;
    }
    if (
      start !== null &&
      paragraph !== null &&
      /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i])
    ) {
      end = paragraph;
      break;
    }
    paragraph = lines[i].trim() ? (paragraph ?? i) : null;
  }
  return start === null
    ? null
    : lines.slice(start, end).join("\n").trim() || null;
}
function validateMetadata(scanned, current, report) {
  if (!scanned || !current) throw new Error();
  validateRevisions(scanned, current);
  if (
    !shaPattern.test(scanned.treeSha) ||
    scanned.configCommit !== scanned.baseSha ||
    scanned.configCommit !== report.policy.configCommit ||
    scanned.policyHash !== report.policy.active.hash ||
    typeof current.body !== "string" ||
    !Array.isArray(current.labels) ||
    !current.labels.every((label) => typeof label === "string")
  )
    throw new Error();
  for (const scan of report.scanners)
    if (
      scan.report &&
      (scan.report.mergeBase !== scanned.baseSha ||
        scan.report.base !== scanned.baseRef)
    )
      throw new Error();
}
const result = (exitCode, outcome, message, rationale = null) => ({
  exitCode,
  outcome,
  rationale,
  message,
});
/** Pure evidence checks; the hosted runner must first perform full source-aware validation. */
export function evaluatePolicy({ report, scanned, current, toolVerified }) {
  try {
    validatePolicyReport(report);
    validateMetadata(scanned, current, report);
    if (toolVerified !== true || report.strictExitCode === 2) throw new Error();
  } catch {
    return result(
      2,
      "error",
      "Tool verification, preparation or quality evidence failed. Exceptions do not apply.",
    );
  }
  if (
    ["headSha", "baseRef", "baseSha"].some(
      (key) => scanned[key] !== current[key],
    )
  )
    return result(
      1,
      "stale",
      "PR head or target branch changed. Rerun against the current revision.",
    );
  const label = current.labels.includes("quality-exception"),
    rationale = extractRationale(current.body);
  if (label && !rationale)
    return result(
      1,
      "invalid-exception",
      "Supply a reason under ## Quality exception or remove quality-exception.",
    );
  if (report.strictExitCode === 0)
    return report.coverage.blockingFiles === 0
      ? result(
          0,
          "advisory",
          "Advisory only: zero blocking source coverage. No blocking ratchets ran.",
          label ? rationale : null,
        )
      : result(
          0,
          "clean",
          "No new blocking quality regressions.",
          label ? rationale : null,
        );
  return label
    ? result(
        0,
        "exception",
        "Accepted PR-wide exception. Strict findings remain visible.",
        rationale,
      )
    : result(
        1,
        "regression",
        "New quality regressions must be fixed or explicitly exempted.",
      );
}

function validateRevisions(scanned, current) {
  for (const value of [scanned, current]) {
    if (
      !shaPattern.test(value.headSha) ||
      !shaPattern.test(value.baseSha) ||
      !validRef(value.baseRef)
    )
      throw new Error();
  }
}
