import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveComparison, loadPolicySelection } from "./git/comparison.mjs";
import { SetupError } from "./git/commands.mjs";
import { ConfigurationError } from "./config/validate.mjs";
import { runQuality, runScanner, diagnosticRecord } from "./runner.mjs";
import { coverageFor, scanContext } from "./report.mjs";
import { collectTestSourceInventory } from "./reports/test-size.mjs";
import { summarizeTestDebt } from "./reports/test-debt.mjs";
import { toolManifest } from "./tool-manifest.mjs";
import { supportsNodeVersion } from "./runtime.mjs";
const toolRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export function parseArgs(argv) {
  const args = [...argv],
    command = args[0] && !args[0].startsWith("-") ? args.shift() : "check";
  if (
    ![
      "check",
      "report-test-debt",
      "report-test-size",
      "explain-config",
    ].includes(command)
  )
    throw new SetupError("Unsupported command");
  const options = { command, repo: process.cwd(), json: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new SetupError("Duplicate option");
    seen.add(flag);
    if (flag === "--json") {
      options.json = true;
      continue;
    }
    if (
      flag !== "--repo" &&
      !(flag === "--base" && ["check", "explain-config"].includes(command))
    )
      throw new SetupError("Unsupported option");
    const value = args[++index];
    if (!value || value.startsWith("-") || value.includes("\0"))
      throw new SetupError("Option requires a value");
    options[flag.slice(2)] = value;
  }
  return options;
}
function renderScanners(report) {
  const lines = [
    `Enabled files: ${report.coverage.enabledFiles}; blocking coverage: ${report.coverage.blockingFiles}`,
  ];
  if (report.coverage.error) lines.push(report.coverage.error);
  for (const scan of report.scanners) {
    lines.push(
      `${scan.name}: ${scan.state}${scan.error ? ` (${scan.error})` : ""}`,
    );
    lines.push(
      ...(scan.report?.findings ?? [])
        .slice(0, 30)
        .map((row) => JSON.stringify(row)),
    );
    if (scan.report?.findings.length > 30)
      lines.push("Additional findings are available with --json.");
  }
  return lines;
}
function renderView(name, view) {
  const lines = [
    `${name}: ${view.state} (informational; ${view.coverage.inventory})`,
  ];
  if (view.error) lines.push(view.error);
  if (!view.data) return lines;
  const source = view.data.source ?? view.data;
  lines.push(
    `Test source: ${source.files} files / ${source.lines} lines; ${source.oversizedFiles.length} oversized files at ${source.oversizedLines} lines.`,
    ...source.oversizedFiles.slice(0, 15).map((row) => JSON.stringify(row)),
  );
  if (view.data.hotspots)
    lines.push(
      `Exact pairs: ${view.data.exactClonePairs}; test-involved: ${view.data.testInvolvedPairs}`,
      ...view.data.hotspots.map((row) => JSON.stringify(row)),
      view.data.caveat,
    );
  return lines;
}
function render(report) {
  const lines = [
    `Active policy: ${report.policy.active.hash} from ${report.policy.configCommit}`,
    "Omitted settings use resolved tool defaults. Proposed settings do not enforce this comparison.",
  ];
  if (report.policy.changed)
    lines.push(
      "Proposed policy changes:",
      ...report.policy.diff.map((row) => JSON.stringify(row)),
    );
  if (report.scanners) lines.push(...renderScanners(report));
  const views =
    report.advisories ??
    (report.report ? { [report.command]: report.report } : {});
  for (const [name, view] of Object.entries(views))
    lines.push(...renderView(name, view));
  if (!report.scanners && !report.report)
    lines.push(
      JSON.stringify(report.policy.active, null, 2),
      JSON.stringify(report.coverage),
    );
  return lines.join("\n");
}
function diagnostic(command, context) {
  const name = command === "report-test-size" ? "testSize" : "testDebt";
  const enabled =
    name === "testSize"
      ? context.selection.active.reports.testSize.enabled
      : context.selection.active.reports.testDebt;
  if (!enabled) return diagnosticRecord(name, context);
  try {
    const inventory = collectTestSourceInventory(scanContext(context));
    if (name === "testSize")
      return diagnosticRecord(name, context, inventory.testSize);
    const duplication = runScanner("duplication", context);
    if (duplication.state !== "scanned")
      throw new Error("Diagnostic scan failed");
    return diagnosticRecord(
      name,
      context,
      summarizeTestDebt(duplication.report.currentClones, inventory.testDebt),
    );
  } catch {
    return diagnosticRecord(
      name,
      context,
      null,
      "Enabled diagnostic report failed",
    );
  }
}
function inspectTool(argv) {
  if (argv.length === 1 && argv[0] === "--version") {
    console.log(toolManifest(toolRoot).version);
    return true;
  }
  if (argv[0] === "tool-manifest") {
    if (argv.length > 2 || (argv[1] && argv[1] !== "--json"))
      throw new SetupError("Unsupported manifest option");
    console.log(JSON.stringify(toolManifest(toolRoot), null, 2));
    return true;
  }
  return false;
}
export async function main(argv = process.argv.slice(2)) {
  const json = argv.includes("--json");
  try {
    if (!supportsNodeVersion(process.versions.node))
      throw new SetupError("Unsupported tool runtime; use Node >=24.22.1 <25");
    if (inspectTool(argv)) return 0;
    const options = parseArgs(argv);
    const comparison = resolveComparison({
      repo: resolve(options.repo),
      base: options.command.startsWith("report-") ? "HEAD" : options.base,
    });
    const context = {
      comparison,
      selection: loadPolicySelection(comparison),
      toolRoot,
    };
    let report, code;
    if (options.command === "check") {
      report = await runQuality(context);
      code = report.strictExitCode;
    } else if (options.command === "explain-config") {
      report = { policy: context.selection, coverage: coverageFor(context) };
      code = 0;
    } else {
      const view = diagnostic(options.command, context);
      report = {
        command: options.command,
        policy: context.selection,
        report: view,
      };
      code = view.state === "error" ? 2 : 0;
    }
    console.log(json ? JSON.stringify(report, null, 2) : render(report));
    return code;
  } catch (error) {
    const message =
      error instanceof SetupError || error instanceof ConfigurationError
        ? error.message
        : "Quality operation failed";
    console.log(
      json
        ? JSON.stringify({
            schemaVersion: 1,
            error: message,
            strictExitCode: 2,
          })
        : message,
    );
    return 2;
  }
}
