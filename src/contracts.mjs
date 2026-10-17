/**
 * @typedef {"duplication" | "complexity" | "file-size"} GateName
 * @typedef {"ratchet" | "advisory" | "off"} CheckMode
 * @typedef {{include?: string[], exclude?: string[]}} ScopeInput
 * @typedef {{mode?: CheckMode, reason?: string}} ModeInput
 * @typedef {ModeInput & {cyclomatic?: number, cognitive?: number}} ComplexityOverride
 * @typedef {ModeInput & {maxLines?: number}} FileSizeOverride
 * @typedef {ComplexityOverride & ScopeInput} ComplexityInput
 * @typedef {FileSizeOverride & ScopeInput} FileSizeInput
 * @typedef {ModeInput & ScopeInput & {minLines?: number, minTokens?: number, formats?: string[]}} DuplicationInput
 * @typedef {{files: string[], reason: string, checks: {complexity?: ComplexityOverride, fileSize?: FileSizeOverride}}} PolicyOverride
 * @typedef {{testDebt?: boolean, testSize?: {enabled?: boolean, oversizedLines?: number}}} ReportsInput
 * @typedef {{schemaVersion: 1, scope?: ScopeInput, checks?: {complexity?: ComplexityInput, fileSize?: FileSizeInput, duplication?: DuplicationInput}, overrides?: PolicyOverride[], reports?: ReportsInput}} ConfigInput
 *
 * @typedef {{include: string[], exclude: string[]}} ResolvedScope
 * @typedef {{mode: CheckMode, reason: string | null, include: string[], exclude: string[]}} ResolvedCheck
 * @typedef {ResolvedCheck & {cyclomatic: number, cognitive: number}} ResolvedComplexity
 * @typedef {ResolvedCheck & {maxLines: number}} ResolvedFileSize
 * @typedef {ResolvedCheck & {minLines: number, minTokens: number, formats: string[]}} ResolvedDuplication
 * @typedef {{schemaVersion: 1, scope: ResolvedScope, checks: {complexity: ResolvedComplexity, fileSize: ResolvedFileSize, duplication: ResolvedDuplication}, overrides: PolicyOverride[], reports: {testDebt: boolean, testSize: {enabled: boolean, oversizedLines: number}}, hash: string}} ResolvedPolicy
 * @typedef {{mode: CheckMode, reason: string | null, thresholds: {cyclomatic?: number, cognitive?: number, maxLines?: number, minLines?: number, minTokens?: number}, overrideIndices: number[]}} EffectiveCheck
 * @typedef {{path: string, before: unknown, after: unknown}} PolicyDifference
 * @typedef {{active: ResolvedPolicy, proposed: ResolvedPolicy, configCommit: string, changed: boolean, diff: PolicyDifference[]}} PolicySelection
 *
 * Policy hashes cover recursively key-sorted resolved settings, excluding hash itself.
 * Absence or deletion resolves to defaults. Proposed settings never replace active enforcement.
 * Scope matching is a pure path/language/filter decision, independent of effective mode.
 * Discovery rejects symlinks and enumerates real files; the runner must reject empty enabled coverage.
 * Gate findings retain scanner-specific fields and add mode and overrideIndices.
 */
export {};

import { isAbsolute } from "node:path";
import { resolvePolicy } from "./config/resolve.mjs";
import { sourcePath } from "./git/paths.mjs";
import { SetupError } from "./git/commands.mjs";
/**
 * @typedef {{repo: string, baselineSha: string, headSha: string, baseRef: string | null, treeSha: string | null, workingTreeHash?: string, ranges: Map, renames: Map}} Comparison
 * @typedef {{comparison: Comparison, policy: ResolvedPolicy, toolRoot: string}} ScanContext
 * @typedef {{comparison: Comparison, selection: PolicySelection, toolRoot: string}} RunContext
 */
const shaPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
function invalidContext() {
  throw new SetupError("Invalid scan context or policy identity");
}
function entries(value, validate) {
  if (!Array.isArray(value)) invalidContext();
  const result = new Map();
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) invalidContext();
    const [path, item] = entry;
    sourcePath(path);
    if (result.has(path) || !validate(item)) invalidContext();
    result.set(path, item);
  }
  return result;
}
function hunks(value) {
  return entries(
    value,
    (items) =>
      Array.isArray(items) &&
      items.every(
        (item) =>
          item &&
          ["oldStart", "oldCount", "newStart", "newCount"].every(
            (key) => Number.isSafeInteger(item[key]) && item[key] >= 0,
          ),
      ),
  );
}
function validatePolicy(policy) {
  if (!policy || !/^[a-f0-9]{64}$/u.test(policy.hash)) invalidContext();
  const input = structuredClone(policy);
  delete input.hash;
  for (const check of Object.values(input.checks ?? {}))
    if (check.reason === null) delete check.reason;
  const resolved = resolvePolicy(input);
  if (resolved.hash !== policy.hash) invalidContext();
  return resolved;
}
/** Maps and their hunk/new-path metadata cross scanner subprocesses explicitly. */
export function encodeScanContext(context) {
  const { comparison } = context;
  const json = JSON.stringify({
    ...context,
    comparison: {
      ...comparison,
      ranges: [...comparison.ranges],
      renames: [...comparison.renames],
      rangeHunks: [...(comparison.ranges.hunks ?? new Map())],
      renameHunks: [
        ...(comparison.renames.hunks ?? comparison.ranges.hunks ?? new Map()),
      ],
      newPaths: [...(comparison.renames.newPaths ?? new Set())],
    },
  });
  decodeScanContext(json);
  return json;
}
export function decodeScanContext(json) {
  let context;
  try {
    context = JSON.parse(json);
  } catch {
    invalidContext();
  }
  const comparison = context?.comparison;
  if (
    !comparison ||
    typeof comparison.repo !== "string" ||
    !isAbsolute(comparison.repo) ||
    typeof context.toolRoot !== "string" ||
    !isAbsolute(context.toolRoot) ||
    !shaPattern.test(comparison.baselineSha) ||
    !shaPattern.test(comparison.headSha) ||
    (comparison.treeSha !== null && !shaPattern.test(comparison.treeSha)) ||
    (comparison.baseRef !== null &&
      (typeof comparison.baseRef !== "string" ||
        !comparison.baseRef ||
        comparison.baseRef.startsWith("-") ||
        comparison.baseRef.includes("\0")))
  )
    invalidContext();
  if (
    comparison.workingTreeHash !== undefined &&
    !/^[a-f0-9]{64}$/u.test(comparison.workingTreeHash)
  )
    invalidContext();
  const ranges = entries(
    comparison.ranges,
    (items) =>
      Array.isArray(items) &&
      items.every(
        (range) =>
          Array.isArray(range) &&
          range.length === 2 &&
          Number.isSafeInteger(range[0]) &&
          Number.isSafeInteger(range[1]) &&
          range[0] >= 1 &&
          range[1] >= range[0],
      ),
  );
  const renames = entries(comparison.renames, (value) => {
    sourcePath(value);
    return true;
  });
  ranges.hunks = hunks(comparison.rangeHunks);
  renames.hunks = hunks(comparison.renameHunks);
  if (!Array.isArray(comparison.newPaths)) invalidContext();
  renames.newPaths = new Set(comparison.newPaths.map(sourcePath));
  ranges.renames = renames;
  const { rangeHunks, renameHunks, newPaths, ...identity } = comparison;
  return {
    comparison: { ...identity, ranges, renames },
    policy: validatePolicy(context.policy),
    toolRoot: context.toolRoot,
  };
}
