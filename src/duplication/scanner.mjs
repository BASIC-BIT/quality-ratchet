import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SetupError } from "../git/commands.mjs";
import { sourcePath } from "../git/paths.mjs";
import { withSourceSnapshot } from "../git/snapshot.mjs";
import { matchesScope } from "../config/resolve.mjs";
import {
  formatExtensions,
  formatNames,
  formatForPath,
  nativeFormats,
} from "./formats.mjs";
import {
  fingerprintScannerEndpoint,
  scannerRepoPath,
  NORMALIZED_ENDPOINTS,
} from "./identity.mjs";
import { classify, filterPreExisting } from "./baseline.mjs";
import { assertNoNativeSuppression } from "./suppression.mjs";
const installedRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const positive = (value) => Number.isSafeInteger(value) && value > 0;
function validateEndpointLocation(file, key, lines) {
  if (
    file[key] !== undefined &&
    (!positive(file[key].line) ||
      !Number.isSafeInteger(file[key].column) ||
      file[key].column < 0 ||
      file[key].line !== (key === "startLoc" ? file.start : file.end) ||
      file[key].column >
        Buffer.byteLength(lines[file[key].line - 1] ?? "", "utf8"))
  )
    throw new SetupError("Invalid jscpd endpoint location");
}
function validateEndpoint(repo, file, format, sourceLines) {
  if (
    !file ||
    typeof file.name !== "string" ||
    !positive(file.start) ||
    !positive(file.end) ||
    file.end < file.start
  )
    throw new SetupError("Invalid jscpd endpoint");
  const path = sourcePath(scannerRepoPath(repo, file.name, format));
  if (!existsSync(join(repo, path)))
    throw new SetupError("jscpd endpoint is outside eligible source");
  if (!sourceLines.has(path))
    sourceLines.set(
      path,
      readFileSync(join(repo, path), "utf8").split(/\r?\n/u),
    );
  const lines = sourceLines.get(path);
  if (file.end > lines.length)
    throw new SetupError("jscpd endpoint exceeds eligible source");
  for (const key of ["startLoc", "endLoc"])
    validateEndpointLocation(file, key, lines);
}
/** Validate before reading endpoint source; reports never get to select arbitrary files. */
export function validateNativeReport(report, repo) {
  if (!report || !Array.isArray(report.duplicates))
    throw new SetupError("jscpd returned no duplicate array");
  const total = report.statistics?.total;
  if (
    !total ||
    !["sources", "tokens", "lines", "clones"].every(
      (key) => Number.isSafeInteger(total[key]) && total[key] >= 0,
    ) ||
    total.clones !== report.duplicates.length
  )
    throw new SetupError("Invalid jscpd statistics");
  const sourceLines = new Map();
  for (const row of report.duplicates) {
    if (
      !row ||
      !(nativeFormats.includes(row.format) || row.format === "text") ||
      !positive(row.lines) ||
      !positive(row.tokens)
    )
      throw new SetupError("Invalid jscpd clone measurements");
    for (const file of [row.firstFile, row.secondFile])
      validateEndpoint(repo, file, row.format, sourceLines);
  }
  return report;
}
/** Native CLI and every dependency resolve from the tool, never the consumer. */
export async function runJscpd(repo, opts) {
  const cli = join(
    opts.toolRoot ?? installedRoot,
    "node_modules",
    "jscpd",
    "run-jscpd.js",
  );
  if (!existsSync(cli))
    throw new SetupError(
      "Locked jscpd dependency is missing; run npm ci in the tool installation",
    );
  const out = mkdtempSync(join(tmpdir(), "quality-duplicates-"));
  try {
    const config = join(out, "config.json");
    writeFileSync(
      config,
      JSON.stringify({
        formatsExts: formatExtensions,
        formatsNames: formatNames,
        followSymlinks: false,
        ignore: [],
        ignorePattern: [],
      }),
    );
    const args = [
      cli,
      ".",
      "--config",
      config,
      "-k",
      String(opts.minTokens),
      "-l",
      String(opts.minLines),
      "--no-gitignore",
      "--max-size",
      String(Number.MAX_SAFE_INTEGER),
      "--skip-comments",
      "--no-tips",
      "--silent",
      "-r",
      "json,silent",
      "-o",
      out,
    ];
    try {
      execFileSync(process.execPath, args, {
        cwd: repo,
        stdio: ["ignore", "ignore", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
        timeout: 180000,
      });
    } catch {
      throw new SetupError("jscpd failed to run");
    }
    let report;
    try {
      report = JSON.parse(readFileSync(join(out, "jscpd-report.json"), "utf8"));
    } catch {
      throw new SetupError("jscpd produced no readable report");
    }
    validateNativeReport(report, repo);
    const cache = new Map();
    const rows = await Promise.all(
      report.duplicates.map(async (d) => {
        const [a, b] = await Promise.all([
          fingerprintScannerEndpoint(repo, d.firstFile, d.format, cache),
          fingerprintScannerEndpoint(repo, d.secondFile, d.format, cache),
        ]);
        if (a.layoutOnly || b.layoutOnly) return null;
        return {
          kind: "token",
          a: scannerRepoPath(repo, d.firstFile.name, d.format),
          aFormat: d.format,
          as: d.firstFile.start,
          ae: d.firstFile.end,
          af: a.fingerprint,
          b: scannerRepoPath(repo, d.secondFile.name, d.format),
          bFormat: d.format,
          bs: d.secondFile.start,
          be: d.secondFile.end,
          bf: b.fingerprint,
          lines: d.lines,
          tokens: d.tokens,
          [NORMALIZED_ENDPOINTS]: { a: a.normalized, b: b.normalized },
        };
      }),
    );
    return rows.filter(Boolean);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
function publicClone(row) {
  const { [NORMALIZED_ENDPOINTS]: internal, ...result } = row;
  return result;
}
/** One current scan also supplies the absolute diagnostic inventory. */
export async function scanDuplication(context) {
  const { comparison, policy, toolRoot } = context;
  const check = policy.checks.duplication;
  return withSourceSnapshot(context, async (snapshot) => {
    const paths = { base: [], current: [] };
    for (const side of ["base", "current"])
      for (const path of snapshot.paths[side]) {
        const source = readFileSync(join(snapshot[side], path), "utf8");
        const format = formatForPath(path, source);
        if (
          check.mode !== "off" &&
          matchesScope(policy, "duplication", path, format)
        ) {
          assertNoNativeSuppression(source, format, path);
          paths[side].push(path);
        } else rmSync(join(snapshot[side], path));
      }
    const opts = {
      minLines: check.minLines,
      minTokens: check.minTokens,
      toolRoot,
    };
    const current = paths.current.length
      ? await runJscpd(snapshot.current, opts)
      : [];
    const baseline = paths.base.length
      ? await runJscpd(snapshot.base, opts)
      : [];
    const { findings, preExisting } = filterPreExisting(
      classify(current, comparison.ranges, opts),
      baseline,
      comparison.renames,
    );
    return {
      base: comparison.baseRef ?? comparison.baselineSha,
      mergeBase: comparison.baselineSha,
      policyHash: policy.hash,
      changedFiles: [...comparison.ranges.keys()].filter((p) =>
        paths.current.includes(p),
      ).length,
      scanned: current.length,
      coverage: {
        limitations: check.formats.includes("markdown")
          ? ["markdown-prose-requires-fenced-tokens"]
          : [],
        eligibleFiles: paths.current.length,
        baselineFiles: paths.base.length,
        formats: check.formats,
        mode: check.mode,
        excluded: snapshot.excluded,
      },
      findings: findings.map((row) => ({
        ...publicClone(row),
        mode: check.mode,
        overrideIndices: [],
      })),
      preExisting,
      currentClones: current.map(publicClone),
    };
  });
}
