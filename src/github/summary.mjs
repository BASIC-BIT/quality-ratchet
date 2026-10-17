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
          })
        : "missing"),
  ];
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
