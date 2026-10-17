import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeScanContext } from "./contracts.mjs";
import {
  GATES,
  gateEnabled,
  scanContext,
  validateRunContext,
  validateGateReport,
  validateQualityReport,
  coverageFor,
  strictOutcome,
} from "./report.mjs";
import { collectTestSourceInventory } from "./reports/test-size.mjs";
import { summarizeTestDebt } from "./reports/test-debt.mjs";
const installedRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export function runNode(
  entrypoint,
  input,
  { timeout = 180_000, maxBuffer = 64 * 1024 * 1024 } = {},
) {
  return spawnSync(process.execPath, [entrypoint], {
    input,
    encoding: "utf8",
    timeout,
    maxBuffer,
    windowsHide: true,
    cwd: installedRoot,
    shell: false,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !["NODE_OPTIONS", "NODE_PATH"].includes(key.toUpperCase()),
      ),
    ),
  });
}
export function parseScannerResult(name, raw, context) {
  const failed = (error) => ({
    name,
    state: "error",
    exitCode: 2,
    report: null,
    error,
  });
  if (raw.error || raw.signal || ![0, 1].includes(raw.status))
    return failed("Scanner process failed");
  try {
    const report = JSON.parse(raw.stdout);
    validateGateReport(name, report, raw.status, context);
    return {
      name,
      state: "scanned",
      exitCode: raw.status,
      report,
      error: null,
    };
  } catch {
    return failed("Invalid scanner report");
  }
}
export function runScanner(name, context) {
  if (!gateEnabled(context, name))
    return {
      name,
      state: "disabled",
      exitCode: null,
      report: null,
      error: null,
      coverage: {
        policyHash: context.selection.active.hash,
        eligibleFiles: 0,
        reason: "off-by-policy",
      },
    };
  return parseScannerResult(
    name,
    runNode(
      join(installedRoot, "src", "scanners", `${name}.mjs`),
      encodeScanContext(scanContext(context)),
    ),
    context,
  );
}
export function diagnosticRecord(name, context, data = null, error = null) {
  const settings = context.selection.active.reports;
  const enabled =
    name === "testSize" ? settings.testSize.enabled : settings.testDebt;
  return {
    state: !enabled ? "disabled" : error ? "error" : "reported",
    data: enabled && !error ? data : null,
    error: enabled ? error : null,
    coverage: {
      policyHash: context.selection.active.hash,
      sourceGate: name === "testSize" ? "file-size" : "duplication",
      inventory: "JS/TS test/support source within active scope",
    },
  };
}
export function collectDiagnostics(context, scanners) {
  let inventory;
  try {
    inventory = collectTestSourceInventory(scanContext(context));
  } catch {
    return Object.fromEntries(
      ["testSize", "testDebt"].map((name) => [
        name,
        diagnosticRecord(
          name,
          context,
          null,
          "Enabled diagnostic report failed",
        ),
      ]),
    );
  }
  const duplication = scanners.find((scan) => scan.name === "duplication");
  const debt =
    context.selection.active.reports.testDebt &&
    duplication?.state === "scanned"
      ? summarizeTestDebt(duplication.report.currentClones, inventory.testDebt)
      : null;
  return {
    testSize: diagnosticRecord("testSize", context, inventory.testSize),
    testDebt: diagnosticRecord(
      "testDebt",
      context,
      debt,
      debt ? null : "Enabled diagnostic report failed",
    ),
  };
}
export function combineResults(results, context) {
  validateRunContext(context);
  const advisories = collectDiagnostics(context, results),
    coverage = coverageFor(context);
  return validateQualityReport(
    {
      schemaVersion: 1,
      policy: context.selection,
      scanners: results,
      strictExitCode: strictOutcome(results, advisories, coverage),
      advisories,
      coverage,
    },
    context,
  );
}
export async function runQuality(context) {
  validateRunContext(context);
  const scanners = GATES.map((name) => runScanner(name, context));
  return combineResults(scanners, context);
}
