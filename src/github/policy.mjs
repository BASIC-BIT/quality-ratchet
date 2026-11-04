// Rationale parser adapted from Chronote; see docs/provenance.md.
import { validatePolicyReport } from "../report.mjs";
import { shaPattern, validRef } from "./client.mjs";
const policyHashPattern = /^[a-f0-9]{64}$/u;
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
/** The enforced policy must be the merge-base policy the report measured. */
function validPolicyIdentity(scanned, report) {
  return (
    policyHashPattern.test(scanned.baseTipPolicyHash) &&
    scanned.configCommit === scanned.baseSha &&
    scanned.configCommit === report.policy.configCommit &&
    scanned.policyHash === report.policy.active.hash
  );
}
function validateMetadata(scanned, current, report) {
  if (!scanned || !current) throw new Error();
  validateRevisions(scanned, current);
  if (
    !shaPattern.test(scanned.treeSha) ||
    !shaPattern.test(scanned.baseTipSha) ||
    !validPolicyIdentity(scanned, report) ||
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
  const blocked = branchStateResult(scanned, current);
  if (blocked) return blocked;
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

/** Blocking branch-state checks, before any clean, advisory or exception verdict. */
function branchStateResult(scanned, current) {
  // baseSha is the compared merge base, not the target tip: unrelated merges
  // into the target branch move the tip without invalidating this scan.
  if (
    ["headSha", "baseRef", "baseSha"].some(
      (key) => scanned[key] !== current[key],
    )
  )
    return result(
      1,
      "stale",
      "PR head, target branch or merge base changed. Rerun against the current revision.",
    );
  // Enforcement reads the merge base, so a target branch whose policy has since
  // changed cannot apply it to this PR. Blocking keeps the divergence visible
  // instead of quietly enforcing the policy at the branch point. It is its own
  // outcome because only a rebase or merge clears it: reporting stale invites a
  // rerun loop that can never terminate.
  if (scanned.policyHash !== scanned.baseTipPolicyHash)
    return result(
      1,
      "policy-divergence",
      "The target branch policy differs from the policy at this branch's merge base. Rebase or merge the target branch so its current policy applies.",
    );
  return null;
}

function validateRevisions(scanned, current) {
  for (const value of [scanned, current])
    if (!shaPattern.test(value.headSha) || !validRef(value.baseRef))
      throw new Error();
  if (!shaPattern.test(scanned.baseSha)) throw new Error();
  // A retarget is stale from baseRef alone and its merge base need not exist, so
  // the live merge base may be absent. Absent never equals the scanned one.
  if (current.baseSha !== null && !shaPattern.test(current.baseSha))
    throw new Error();
}
