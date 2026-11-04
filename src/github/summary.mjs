import { policyDiverged } from "./divergence.mjs";
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"]/gu,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
  );
}
const limit = 60_000;
/** HTML preformatted text makes Markdown inert; escape only at this output boundary. */
export function renderSummary({ report, scanned, current, result }) {
  const lines = [
    "Code quality ratchet",
    result.message,
    "Outcome: " + result.outcome,
    "Strict exit: " + (report?.strictExitCode ?? "missing"),
    "Scanned revision: " + (scanned ? JSON.stringify(scanned) : "missing"),
    "Current revision: " +
      (current
        ? JSON.stringify({
            headSha: current.headSha,
            baseRef: current.baseRef,
            baseSha: current.baseSha,
            baseTipSha: current.baseTipSha,
            baseTipPolicyHash: current.baseTipPolicyHash,
          })
        : "missing"),
  ];
  // The target branch itself carries a configuration this tool cannot read. No
  // outcome reports it, because it does not block; publication also annotates it.
  if (current?.baseTipPolicyUnreadable)
    lines.push(
      "Target branch configuration did not resolve at " +
        current.baseTipSha +
        ", so the policy divergence check did not run. Fix quality-ratchet.json on the target branch.",
    );
  // Advisory: the enforced policy is the merge-base one and the target branch
  // has since moved on. No outcome reports it; publication also annotates it.
  if (policyDiverged(scanned, current))
    lines.push(
      "The target branch policy differs from the enforced merge-base policy, so this run did not measure against the target branch's current policy. Rebase or merge the target branch to adopt it. The outcome is unaffected.",
    );
  lines.push(...reportLines(report));
  if (result.rationale) lines.push("Exception rationale:", result.rationale);
  let text = lines.join("\n");
  if (text.length > limit)
    text = text.slice(0, limit) + "\nSummary truncated. See JSON evidence.";
  return "<pre>" + escapeHtml(text) + "</pre>\n";
}

function reportLines(report) {
  if (!report) return ["Quality report: missing"];
  const lines = [];
  {
    lines.push("Coverage: " + JSON.stringify(report.coverage));
    lines.push(
      "Policy: " +
        report.policy.active.hash +
        "; config commit: " +
        report.policy.configCommit,
    );
    lines.push(
      "Proposed policy changes: " + JSON.stringify(report.policy.diff),
    );
    for (const scan of report.scanners) {
      lines.push(
        scan.name + ": " + scan.state + "; measured exit: " + scan.exitCode,
      );
      for (const f of (scan.report?.findings ?? []).slice(0, 100))
        lines.push(JSON.stringify(f));
      if (scan.report?.findings.length > 100)
        lines.push("Further findings are in the JSON report.");
    }
    for (const [name, item] of Object.entries(report.advisories))
      lines.push(name + ": " + item.state + "; " + JSON.stringify(item.data));
  }
  return lines;
}
