// Validation adapted from Chronote's combined checker; see docs/provenance.md.
import { isDeepStrictEqual } from "node:util";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHECK_KEYS } from "./config/defaults.mjs";
import { effectiveCheck, diffPolicies } from "./config/resolve.mjs";
import { encodeScanContext, validatePolicy } from "./contracts.mjs";
import { createSourceSnapshot } from "./git/snapshot.mjs";
import {
  listEligiblePaths,
  sourcePath,
  matchesSourceScope,
} from "./git/paths.mjs";
import { touchesDiff } from "./git/diff.mjs";
import { nativeFormats } from "./duplication/formats.mjs";
import { scannerScope } from "./scanners/scope.mjs";
import { physicalLines } from "./scanners/file-size.mjs";
import { summarizeTestSources } from "./reports/test-size.mjs";
import { summarizeTestDebt } from "./reports/test-debt.mjs";
import { isTestSourcePath } from "./reports/scope.mjs";
import { matchesScope, matchesPathScope } from "./config/resolve.mjs";
export const GATES = ["duplication", "complexity", "file-size"];
export const OPERATIONAL_ERRORS = [
  "Scanner process failed",
  "Invalid scanner report",
  "Enabled diagnostic report failed",
];
const count = (n) => Number.isSafeInteger(n) && n >= 0;
const positive = (n) => count(n) && n > 0;
export function requireValid(condition, message = "Invalid quality report") {
  if (!condition) throw new Error(message);
}
export function exactKeys(value, keys) {
  requireValid(value && typeof value === "object" && !Array.isArray(value));
  requireValid(Object.keys(value).every((key) => keys.includes(key)));
}
const equal = (a, b) => requireValid(isDeepStrictEqual(a, b));
export const scanContext = (context) => ({
  comparison: context.comparison,
  policy: context.selection.active,
  toolRoot: context.toolRoot,
});
export function validateRunContext(context) {
  encodeScanContext(scanContext(context));
  encodeScanContext({
    ...scanContext(context),
    policy: context.selection.proposed,
  });
  equal(context.selection.configCommit, context.comparison.baselineSha);
  const diff = diffPolicies(
    context.selection.active,
    context.selection.proposed,
  );
  equal(context.selection.diff, diff);
  equal(context.selection.changed, diff.length > 0);
}
export function gatePaths(context, name) {
  return listEligiblePaths(scanContext(context), name);
}
export function gateEnabled(context, name) {
  return (
    context.selection.active.checks[CHECK_KEYS[name]].mode !== "off" ||
    gatePaths(context, name).length > 0
  );
}
export function coverageFor(context) {
  const enabled = new Set(),
    blocking = new Set();
  const gates = Object.fromEntries(
    GATES.map((name) => {
      const paths = gatePaths(context, name);
      for (const path of paths) {
        enabled.add(path);
        if (
          effectiveCheck(context.selection.active, name, path).mode ===
          "ratchet"
        )
          blocking.add(path);
      }
      return [name, paths.length];
    }),
  );
  return {
    enabledFiles: enabled.size,
    blockingFiles: blocking.size,
    gates,
    error: enabled.size ? null : "No enabled eligible source coverage",
  };
}
function evidenceFor(context) {
  const snapshot = createSourceSnapshot(scanContext(context));
  try {
    const sourceBounds = new Map(
      snapshot.paths.current.map((path) => {
        const text = readFileSync(join(snapshot.current, path), "utf8");
        return [
          path,
          {
            physical: physicalLines(text),
            native: text.split(/\r?\n/u).length,
          },
        ];
      }),
    );
    const scan = scanContext(context);
    const metadata = Object.fromEntries(
      ["complexity", "file-size"].map((name) => [
        name,
        scannerScope(scan, snapshot, name).metadata,
      ]),
    );
    metadata.duplication = {
      coverage: {
        baselineFiles: snapshot.paths.base.filter((path) =>
          matchesSourceScope(scan.policy, "duplication", path, snapshot.base),
        ).length,
        excluded: snapshot.excluded,
      },
    };
    return { sourceBounds, metadata };
  } finally {
    snapshot.dispose();
  }
}
function exclusions(value) {
  exactKeys(value, ["base", "current"]);
  for (const side of ["base", "current"]) {
    requireValid(Array.isArray(value[side]));
    for (const row of value[side]) {
      exactKeys(row, ["path", "reason"]);
      sourcePath(row.path);
      requireValid(
        ["deleted", "symlink", "nested-checkout", "non-file"].includes(
          row.reason,
        ),
      );
    }
  }
}
function effectiveMetadata(finding, expected, duplication = false) {
  equal(finding.mode, expected.mode);
  requireValid(expected.mode !== "off");
  equal(finding.overrideIndices, expected.overrideIndices);
  if (!duplication) {
    equal(finding.thresholds, expected.thresholds);
    equal(finding.reason, expected.reason);
  }
}
const cloneKeys = [
  "kind",
  "a",
  "aFormat",
  "as",
  "ae",
  "af",
  "b",
  "bFormat",
  "bs",
  "be",
  "bf",
  "lines",
  "tokens",
];
function clone(row, paths, sourceBounds) {
  cloneShape(row);
  for (const side of ["a", "b"]) {
    requireValid(paths.has(row[side]));
    requireValid(row[side + "e"] <= sourceBounds.get(row[side]).native);
  }
}
function cloneShape(row) {
  requireValid(
    row.kind === "token" && positive(row.lines) && positive(row.tokens),
  );
  for (const side of ["a", "b"]) {
    sourcePath(row[side]);
    requireValid(
      positive(row[side + "s"]) &&
        positive(row[side + "e"]) &&
        row[side + "s"] <= row[side + "e"],
    );
    requireValid(
      nativeFormats.includes(row[side + "Format"]) ||
        row[side + "Format"] === "text",
    );
    requireValid(
      row[side + "f"] === null || /^[a-f0-9]{64}$/u.test(row[side + "f"]),
    );
  }
}

function comparisonValues(f, pairs) {
  if (f.verdict === "NEW") return pairs.every(([, base]) => f[base] === null);
  return (
    f.verdict === "GREW" &&
    pairs.every(([, base]) => count(f[base])) &&
    pairs.some(([now, base]) => f[now] > f[base])
  );
}
const policyFields = ["mode", "reason", "thresholds", "overrideIndices"];
function measurementFinding(name, f, context, paths, sourceBounds) {
  const size = name === "file-size";
  exactKeys(f, findingKeys(name));
  sourcePath(f.file);
  requireValid(paths.has(f.file) && context.comparison.ranges.has(f.file));
  const check = effectiveCheck(context.selection.active, name, f.file);
  effectiveMetadata(f, check);
  if (size) {
    requireValid(
      positive(f.lines) &&
        f.lines === sourceBounds.get(f.file).physical &&
        f.lines >= check.thresholds.maxLines &&
        comparisonValues(f, [["lines", "baseLines"]]),
    );
    return;
  }
  requireValid(
    typeof f.key === "string" && f.key.length > 0 && positive(f.familySize),
  );
  requireValid(
    positive(f.start) &&
      positive(f.end) &&
      f.end >= f.start &&
      f.end <= sourceBounds.get(f.file).physical,
  );
  requireValid(touchesDiff(context.comparison.ranges, f.file, f.start, f.end));
  requireValid(
    positive(f.cyclomatic) &&
      count(f.cognitive) &&
      (f.cyclomatic > check.thresholds.cyclomatic ||
        f.cognitive > check.thresholds.cognitive),
  );
  requireValid(
    comparisonValues(f, [
      ["cyclomatic", "baseCyclomatic"],
      ["cognitive", "baseCognitive"],
    ]),
  );
}
function validateCoverage(name, coverage, context, paths, metadata) {
  exactKeys(coverage, [
    "eligibleFiles",
    "baselineFiles",
    "excluded",
    "disabled",
    "limitations",
    "formats",
    "mode",
  ]);
  equal(coverage.eligibleFiles, paths.size);
  equal(coverage.baselineFiles, metadata.coverage.baselineFiles);
  exclusions(coverage.excluded);
  equal(coverage.excluded, metadata.coverage.excluded);
  if (name === "duplication") {
    equal(
      coverage.formats,
      context.selection.active.checks.duplication.formats,
    );
    equal(coverage.mode, context.selection.active.checks.duplication.mode);
    equal(
      coverage.limitations,
      coverage.formats.includes("markdown")
        ? ["markdown-prose-requires-fenced-tokens"]
        : [],
    );
    requireValid(coverage.disabled === undefined);
  } else {
    equal(coverage.disabled, metadata.coverage.disabled);
    requireValid(Array.isArray(coverage.disabled));
    for (const row of coverage.disabled) {
      exactKeys(row, ["path", ...policyFields]);
      sourcePath(row.path);
      const check = effectiveCheck(context.selection.active, name, row.path);
      equal(row, { path: row.path, ...check });
      requireValid(check.mode === "off");
    }
    if (name === "complexity")
      equal(coverage.limitations, [
        "anonymous-callbacks-use-source-order",
        "dynamic-computed-targets-use-anonymous-identities",
        "same-name-family-count-changes-are-new",
        "module-static-blocks-are-not-functions",
      ]);
    else requireValid(coverage.limitations === undefined);
    requireValid(coverage.formats === undefined && coverage.mode === undefined);
  }
}
export function validateGateReport(
  name,
  report,
  exitCode,
  context,
  evidence = evidenceFor(context),
) {
  requireValid(GATES.includes(name) && [0, 1].includes(exitCode));
  exactKeys(report, [
    "base",
    "mergeBase",
    "policyHash",
    "changedFiles",
    "scanned",
    "coverage",
    "findings",
    "preExisting",
    "currentClones",
  ]);
  equal(
    report.base,
    context.comparison.baseRef ?? context.comparison.baselineSha,
  );
  equal(report.mergeBase, context.comparison.baselineSha);
  equal(report.policyHash, context.selection.active.hash);
  requireValid(
    count(report.changedFiles) &&
      count(report.scanned) &&
      Array.isArray(report.findings),
  );
  equal(exitCode, report.findings.length ? 1 : 0);
  const paths = new Set(gatePaths(context, name)),
    { sourceBounds, metadata } = evidence;
  equal(
    report.changedFiles,
    [...paths].filter((path) => context.comparison.ranges.has(path)).length,
  );
  validateCoverage(name, report.coverage, context, paths, metadata[name]);
  if (name !== "duplication") {
    equal(report.scanned, report.changedFiles);
    requireValid(
      report.preExisting === undefined && report.currentClones === undefined,
    );
    for (const f of report.findings)
      measurementFinding(name, f, context, paths, sourceBounds);
    return report;
  }
  return validateDuplicationFindings(report, context, paths, sourceBounds);
}
function validateDuplicationFindings(report, context, paths, sourceBounds) {
  const name = "duplication";
  requireValid(
    Array.isArray(report.currentClones) && count(report.preExisting),
  );
  equal(report.scanned, report.currentClones.length);
  requireValid(report.preExisting + report.findings.length <= report.scanned);
  for (const row of report.currentClones) {
    exactKeys(row, cloneKeys);
    clone(row, paths, sourceBounds);
  }
  for (const f of report.findings) {
    exactKeys(f, [
      ...cloneKeys,
      "aTouched",
      "bTouched",
      "verdict",
      "mode",
      "overrideIndices",
    ]);
    clone(f, paths, sourceBounds);
    const check = effectiveCheck(context.selection.active, name, f.a);
    effectiveMetadata(f, check, true);
    requireValid(
      f.lines >= check.thresholds.minLines &&
        f.tokens >= check.thresholds.minTokens,
    );
    requireValid(["added-twice", "duplicates-existing"].includes(f.verdict));
    for (const side of ["a", "b"])
      equal(
        f[`${side}Touched`],
        touchesDiff(
          context.comparison.ranges,
          f[side],
          f[`${side}s`],
          f[`${side}e`],
        ),
      );
    requireValid(f.aTouched || f.bTouched);
    requireValid(
      report.currentClones.some((row) =>
        cloneKeys.every((key) => isDeepStrictEqual(row[key], f[key])),
      ),
    );
  }
  return report;
}
export function validateScannerResult(scan, context, evidence) {
  exactKeys(scan, ["name", "state", "exitCode", "report", "error", "coverage"]);
  requireValid(GATES.includes(scan.name));
  if (scan.state === "disabled") {
    requireValid(!gateEnabled(context, scan.name));
    equal([scan.exitCode, scan.report, scan.error], [null, null, null]);
    equal(scan.coverage, {
      policyHash: context.selection.active.hash,
      eligibleFiles: 0,
      reason: "off-by-policy",
    });
  } else {
    requireValid(
      gateEnabled(context, scan.name) && scan.coverage === undefined,
    );
    if (scan.state === "error") {
      equal([scan.exitCode, scan.report], [2, null]);
      requireValid(OPERATIONAL_ERRORS.includes(scan.error));
    } else {
      requireValid(scan.state === "scanned" && scan.error === null);
      validateGateReport(
        scan.name,
        scan.report,
        scan.exitCode,
        context,
        evidence,
      );
    }
  }
}
export function strictOutcome(scanners, advisories, coverage) {
  if (
    coverage.error ||
    scanners.some((scan) => scan.state === "error") ||
    Object.values(advisories).some((report) => report.state === "error")
  )
    return 2;
  return scanners.some((scan) =>
    scan.report?.findings.some((f) => f.mode === "ratchet"),
  )
    ? 1
    : 0;
}
function validateInventory(inventory, name, context, sourceBounds) {
  exactKeys(inventory, [
    "files",
    "lines",
    "oversizedLines",
    "oversizedFiles",
    "entries",
  ]);
  requireValid(Array.isArray(inventory.entries));
  const gate = name === "testSize" ? "file-size" : "duplication";
  const expectedPaths = [...sourceBounds.keys()]
    .filter(
      (path) =>
        isTestSourcePath(path) &&
        matchesScope(context.selection.active, gate, path),
    )
    .sort();
  equal(
    inventory.entries.map((row) => row.path),
    expectedPaths,
  );
  for (const row of inventory.entries) {
    exactKeys(row, ["path", "lines"]);
    equal(row.lines, sourceBounds.get(row.path).physical);
  }
  equal(
    inventory,
    summarizeTestSources(
      inventory.entries,
      context.selection.active.reports.testSize.oversizedLines,
    ),
  );
}
export function validateAdvisories(advisories, scanners, context, evidence) {
  exactKeys(advisories, ["testSize", "testDebt"]);
  const { sourceBounds } = evidence;
  for (const name of ["testSize", "testDebt"]) {
    const report = advisories[name];
    exactKeys(report, ["state", "data", "error", "coverage"]);
    const enabled =
      name === "testSize"
        ? context.selection.active.reports.testSize.enabled
        : context.selection.active.reports.testDebt;
    equal(report.coverage, {
      policyHash: context.selection.active.hash,
      sourceGate: name === "testSize" ? "file-size" : "duplication",
      inventory: "JS/TS test/support source within active scope",
    });
    if (!enabled) {
      equal(
        [report.state, report.data, report.error],
        ["disabled", null, null],
      );
      continue;
    }
    if (report.state === "error") {
      equal(report.data, null);
      equal(report.error, "Enabled diagnostic report failed");
      continue;
    }
    requireValid(report.state === "reported" && report.error === null);
    const inventory = name === "testSize" ? report.data : report.data.source;
    validateInventory(inventory, name, context, sourceBounds);
    if (name === "testDebt") {
      const duplication = scanners.find((scan) => scan.name === "duplication");
      requireValid(duplication.state === "scanned");
      equal(
        report.data,
        summarizeTestDebt(duplication.report.currentClones, inventory),
      );
    }
  }
}
export function validateQualityReport(report, context) {
  validateRunContext(context);
  validatePolicyReport(report);
  equal(report.policy, context.selection);
  requireValid(Array.isArray(report.scanners));
  equal(report.scanners.map((scan) => scan.name).sort(), [...GATES].sort());
  const evidence = evidenceFor(context);
  for (const scan of report.scanners)
    validateScannerResult(scan, context, evidence);
  equal(report.coverage, coverageFor(context));
  validateAdvisories(report.advisories, report.scanners, context, evidence);
  equal(
    report.strictExitCode,
    strictOutcome(report.scanners, report.advisories, report.coverage),
  );
  return report;
}

function findingKeys(name) {
  const size = name === "file-size";
  if (name === "duplication")
    return [
      ...cloneKeys,
      "aTouched",
      "bTouched",
      "verdict",
      "mode",
      "overrideIndices",
    ];
  return size
    ? ["file", "lines", "baseLines", "verdict", ...policyFields]
    : [
        "file",
        "key",
        "familySize",
        "start",
        "end",
        "cyclomatic",
        "cognitive",
        "baseCyclomatic",
        "baseCognitive",
        "verdict",
        ...policyFields,
      ];
}

/** Pure consistency checks shared by hosted policy and source-aware validation. */
export function validatePolicyReport(report) {
  exactKeys(report, [
    "schemaVersion",
    "policy",
    "scanners",
    "strictExitCode",
    "advisories",
    "coverage",
  ]);
  equal(report.schemaVersion, 1);
  const selection = report.policy;
  exactKeys(selection, [
    "active",
    "proposed",
    "configCommit",
    "changed",
    "diff",
  ]);
  validatePolicy(selection.active);
  validatePolicy(selection.proposed);
  requireValid(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(selection.configCommit));
  const diff = diffPolicies(selection.active, selection.proposed);
  equal(selection.diff, diff);
  equal(selection.changed, diff.length > 0);
  requireValid(Array.isArray(report.scanners));
  equal(report.scanners.map((scan) => scan.name).sort(), [...GATES].sort());
  for (const scan of report.scanners) policyScanner(scan, selection);
  policyCoverage(report);
  policyAdvisories(report);
  equal(
    report.strictExitCode,
    strictOutcome(report.scanners, report.advisories, report.coverage),
  );
  return report;
}
function policyScanner(scan, selection) {
  exactKeys(scan, ["name", "state", "exitCode", "report", "error", "coverage"]);
  if (scan.state === "disabled") {
    equal([scan.exitCode, scan.report, scan.error], [null, null, null]);
    equal(scan.coverage, {
      policyHash: selection.active.hash,
      eligibleFiles: 0,
      reason: "off-by-policy",
    });
    equal(selection.active.checks[CHECK_KEYS[scan.name]].mode, "off");
    return;
  }
  requireValid(scan.coverage === undefined);
  if (scan.state === "error") {
    equal([scan.exitCode, scan.report], [2, null]);
    requireValid(OPERATIONAL_ERRORS.includes(scan.error));
    return;
  }
  equal(scan.state, "scanned");
  equal(scan.error, null);
  const report = scan.report;
  exactKeys(report, [
    "base",
    "mergeBase",
    "policyHash",
    "changedFiles",
    "scanned",
    "coverage",
    "findings",
    "preExisting",
    "currentClones",
  ]);
  equal(report.mergeBase, selection.configCommit);
  equal(report.policyHash, selection.active.hash);
  requireValid(
    typeof report.base === "string" &&
      count(report.changedFiles) &&
      count(report.scanned),
  );
  requireValid(Array.isArray(report.findings));
  equal(scan.exitCode, report.findings.length ? 1 : 0);
  requireValid(
    count(report.coverage.eligibleFiles) &&
      count(report.coverage.baselineFiles),
  );
  policyScanEvidence(scan, selection);
  for (const f of report.findings) {
    exactKeys(f, findingKeys(scan.name));
    const path = scan.name === "duplication" ? f.a : f.file;
    sourcePath(path);
    effectiveMetadata(
      f,
      effectiveCheck(selection.active, scan.name, path),
      scan.name === "duplication",
    );
    requireValid(
      scan.name === "duplication"
        ? matchesPathScope(selection.active, scan.name, path)
        : matchesScope(selection.active, scan.name, path),
    );
    policyMeasurement(scan.name, f);
    if (scan.name === "duplication") {
      const check = effectiveCheck(selection.active, scan.name, path);
      requireValid(
        f.lines >= check.thresholds.minLines &&
          f.tokens >= check.thresholds.minTokens,
      );
    }
  }
}
function policyMeasurement(name, f) {
  if (name === "duplication") {
    cloneShape(f);
    requireValid(["added-twice", "duplicates-existing"].includes(f.verdict));
    requireValid(
      typeof f.aTouched === "boolean" && typeof f.bTouched === "boolean",
    );
    requireValid(f.aTouched || f.bTouched);
    return;
  }
  requireValid(["NEW", "GREW"].includes(f.verdict));
  if (name === "file-size") {
    requireValid(
      positive(f.lines) &&
        f.lines >= f.thresholds.maxLines &&
        comparisonValues(f, [["lines", "baseLines"]]),
    );
  } else {
    requireValid(
      typeof f.key === "string" && f.key.length > 0 && positive(f.familySize),
    );
    requireValid(positive(f.start) && positive(f.end) && f.end >= f.start);
    requireValid(positive(f.cyclomatic) && count(f.cognitive));
    requireValid(
      f.cyclomatic > f.thresholds.cyclomatic ||
        f.cognitive > f.thresholds.cognitive,
    );
    requireValid(
      comparisonValues(f, [
        ["cyclomatic", "baseCyclomatic"],
        ["cognitive", "baseCognitive"],
      ]),
    );
  }
}
function policyCoverage(report) {
  const coverage = report.coverage;
  exactKeys(coverage, ["enabledFiles", "blockingFiles", "gates", "error"]);
  exactKeys(coverage.gates, GATES);
  requireValid(
    count(coverage.enabledFiles) &&
      count(coverage.blockingFiles) &&
      coverage.blockingFiles <= coverage.enabledFiles,
  );
  equal(
    coverage.error,
    coverage.enabledFiles ? null : "No enabled eligible source coverage",
  );
  for (const scan of report.scanners) {
    const n = coverage.gates[scan.name];
    requireValid(count(n) && n <= coverage.enabledFiles);
    if (scan.state === "disabled") equal(n, 0);
    if (scan.state === "scanned") equal(scan.report.coverage.eligibleFiles, n);
    if (scan.report?.findings.some((f) => f.mode === "ratchet"))
      requireValid(coverage.blockingFiles > 0);
  }
  policyBlockingCoverage(report);
  requireValid(
    coverage.enabledFiles <=
      Object.values(coverage.gates).reduce((sum, n) => sum + n, 0),
  );
}
function policyAdvisories(report) {
  exactKeys(report.advisories, ["testSize", "testDebt"]);
  for (const name of ["testSize", "testDebt"]) {
    const item = report.advisories[name],
      settings = report.policy.active.reports;
    exactKeys(item, ["state", "data", "error", "coverage"]);
    equal(item.coverage, {
      policyHash: report.policy.active.hash,
      sourceGate: name === "testSize" ? "file-size" : "duplication",
      inventory: "JS/TS test/support source within active scope",
    });
    const enabled =
      name === "testSize" ? settings.testSize.enabled : settings.testDebt;
    if (!enabled) {
      equal([item.state, item.data, item.error], ["disabled", null, null]);
      continue;
    }
    if (item.state === "error") {
      equal(
        [item.data, item.error],
        [null, "Enabled diagnostic report failed"],
      );
      continue;
    }
    equal(item.state, "reported");
    equal(item.error, null);
    const inventory = name === "testSize" ? item.data : item.data.source;
    requireValid(Array.isArray(inventory.entries));
    for (const row of inventory.entries) {
      exactKeys(row, ["path", "lines"]);
      sourcePath(row.path);
      requireValid(count(row.lines));
    }
    equal(
      inventory,
      summarizeTestSources(inventory.entries, settings.testSize.oversizedLines),
    );
    if (name === "testDebt") {
      const duplication = report.scanners.find(
        (scan) => scan.name === "duplication",
      );
      equal(duplication.state, "scanned");
      equal(
        item.data,
        summarizeTestDebt(duplication.report.currentClones, inventory),
      );
    }
  }
}

function policyScanEvidence(scan, selection) {
  const report = scan.report,
    coverage = report.coverage;
  validateCoverage(
    scan.name,
    coverage,
    { selection },
    { size: coverage.eligibleFiles },
    { coverage },
  );
  if (scan.name === "duplication") {
    requireValid(
      Array.isArray(report.currentClones) && count(report.preExisting),
    );
    equal(report.scanned, report.currentClones.length);
    requireValid(report.preExisting + report.findings.length <= report.scanned);
    for (const row of report.currentClones) {
      exactKeys(row, cloneKeys);
      cloneShape(row);
    }
    for (const f of report.findings)
      requireValid(
        report.currentClones.some((row) =>
          cloneKeys.every((key) => isDeepStrictEqual(row[key], f[key])),
        ),
      );
  } else {
    requireValid(
      report.currentClones === undefined && report.preExisting === undefined,
    );
    equal(report.scanned, report.changedFiles);
  }
}

function policyBlockingCoverage(report) {
  let blockingPossible = false;
  for (const gate of GATES) {
    const key = CHECK_KEYS[gate];
    const modes = new Set([report.policy.active.checks[key].mode]);
    for (const entry of report.policy.active.overrides) {
      if (entry.checks[key]?.mode) modes.add(entry.checks[key].mode);
    }
    if (modes.has("ratchet")) blockingPossible = true;
    if (modes.size === 1 && modes.has("ratchet"))
      requireValid(
        report.coverage.blockingFiles >= report.coverage.gates[gate],
      );
  }
  if (!blockingPossible) equal(report.coverage.blockingFiles, 0);
}
