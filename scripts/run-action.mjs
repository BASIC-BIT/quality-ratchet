import { appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyInstalledTool } from "../src/tool-manifest.mjs";
import { writeEvidence } from "../src/github/evidence.mjs";
import { renderSummary } from "../src/github/summary.mjs";
import { policyDiverged } from "../src/github/divergence.mjs";
import { writeFileSync } from "node:fs";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
export function output(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const delimiter = randomUUID();
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `${name}<<${delimiter}\n${value}\n${delimiter}\n`,
  );
}
export function saveFailure(directory, message) {
  const input = {
    directory,
    report: null,
    scanned: null,
    current: null,
    tool: null,
    result: { exitCode: 2, outcome: "error", rationale: null, message },
  };
  writeEvidence(input);
  writeFileSync(join(directory, "summary.md"), renderSummary(input));
  return input;
}
function escapeProperty(value) {
  return value.replace(
    /[%:,\u0000-\u001f\u007f-\u009f]/gu,
    (char) =>
      "%" + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
  );
}
/**
 * A target branch carrying a configuration this tool rejects disables the
 * divergence check without blocking, so the run reports a passing outcome and
 * only the job summary says enforcement was reduced. An annotation puts that on
 * the checks view too, where a reviewer sees it without opening the summary.
 * Only the saved SHA is interpolated, through the same escape as a file path.
 */
function publishUnreadableTip(current) {
  if (current?.baseTipPolicyUnreadable !== true) return;
  console.log(
    `::warning::The policy divergence check did not run: the target branch configuration did not resolve at ${escapeProperty(String(current.baseTipSha))}. Fix quality-ratchet.json on the target branch.`,
  );
}
/**
 * A divergent target policy changes no outcome, so the checks view is the only
 * place a reviewer sees it without opening the summary. No saved value is
 * interpolated: both hashes are already in the summary and in evidence.
 */
function publishDivergence(scanned, current) {
  if (!policyDiverged(scanned, current)) return;
  console.log(
    "::warning::The target branch policy differs from the enforced merge-base policy, so this run did not measure against the target branch's current policy. Rebase or merge the target branch to adopt it.",
  );
}
export async function publishWarnings(report, current, scanned = null) {
  publishUnreadableTip(current);
  publishDivergence(scanned, current);
  if (!report) return;
  const { validatePolicyReport } = await import("../src/report.mjs");
  validatePolicyReport(report);
  const size = report.advisories.testSize;
  if (size.state !== "reported") return;
  for (const { path, lines } of size.data.oversizedFiles)
    console.log(
      `::warning file=${escapeProperty(path)},line=1::Test/support file has ${lines} physical lines (advisory threshold: ${report.policy.active.reports.testSize.oversizedLines}).`,
    );
}
export async function publish(saved, directory) {
  output("report-directory", directory);
  output("outcome", saved.result.outcome);
  output("strict-exit-code", saved.report?.strictExitCode ?? 2);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      readFileSync(join(directory, "summary.md")),
    );
}
export async function runAction() {
  const directory = process.env.QR_REPORT_DIRECTORY;
  let saved;
  try {
    const events = [
      "opened",
      "synchronize",
      "reopened",
      "ready_for_review",
      "edited",
      "labeled",
      "unlabeled",
    ];
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    if (
      process.env.GITHUB_EVENT_NAME !== "pull_request" ||
      !events.includes(event.action)
    ) {
      saved = saveFailure(
        directory,
        "Unsupported event. Use an ordinary pull_request event listed in the consumer workflow.",
      );
    } else {
      await verifyInstalledTool(
        root,
        JSON.parse(process.env.QR_EXPECTED_MANIFEST),
      );
      const { runHosted } = await import("../src/github/cli.mjs");
      saved = await runHosted({
        checkout: process.env.QR_REPOSITORY_PATH,
        event,
        token: process.env.QR_GITHUB_TOKEN,
        tempRoot: process.env.QR_TEMP_ROOT,
        directory,
        toolVerified: true,
      });
    }
  } catch {
    saved = saveFailure(
      directory,
      "Installed tool verification or execution failed. Rerun the quality check.",
    );
  }
  await publish(saved, directory);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await runAction();
