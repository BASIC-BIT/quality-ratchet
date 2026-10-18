import { createHash } from "node:crypto";
import {
  DEFAULTS,
  HARD_EXCLUDES,
  GENERATED_EXCLUDES,
  CHECK_KEYS,
  THRESHOLD_KEYS,
} from "./defaults.mjs";
import { matchesAny, repositoryPath } from "./glob.mjs";
import { ConfigurationError, validateConfig } from "./validate.mjs";
import { formatForPath, supportedFormats } from "../duplication/formats.mjs";

function merge(base, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && !Array.isArray(value) && typeof value === "object")
      merge((base[key] ??= {}), value);
    else base[key] = structuredClone(value);
  }
  return base;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}

function checkKey(gate) {
  if (!Object.hasOwn(CHECK_KEYS, gate))
    throw new ConfigurationError(`Unsupported gate ${JSON.stringify(gate)}`);
  return CHECK_KEYS[gate];
}

/** @param {import('../contracts.mjs').ConfigInput} [input] @returns {import('../contracts.mjs').ResolvedPolicy} */
export function resolvePolicy(input = { schemaVersion: 1 }) {
  validateConfig(input);
  const policy = merge(structuredClone(DEFAULTS), input);
  if (policy.checks.duplication.mode === "off") {
    if (input.reports?.testDebt === true)
      throw new ConfigurationError(
        "reports.testDebt requires duplication to be enabled",
      );
    policy.reports.testDebt = false;
  }
  const enabled =
    Object.values(policy.checks).some((check) => check.mode !== "off") ||
    policy.overrides.some((entry) =>
      Object.values(entry.checks).some(
        (check) => check.mode && check.mode !== "off",
      ),
    );
  if (!enabled)
    throw new ConfigurationError(
      "At least one check must be enabled, globally or through an override",
    );
  policy.hash = createHash("sha256")
    .update(JSON.stringify(stable(policy)))
    .digest("hex");
  return policy;
}

/** @returns {import('../contracts.mjs').EffectiveCheck} */
export function effectiveCheck(policy, gate, path) {
  const key = checkKey(gate);
  const normalized = repositoryPath(path);
  const check = { ...policy.checks[key] };
  const overrideIndices = [];
  policy.overrides.forEach((entry, index) => {
    const patch = entry.checks[key];
    if (!patch || !matchesAny(normalized, entry.files)) return;
    overrideIndices.push(index);
    Object.assign(check, patch);
    if (
      patch.reason === undefined &&
      patch.mode &&
      patch.mode !== "ratchet" &&
      check.reason === null
    )
      check.reason = entry.reason;
  });
  return {
    mode: check.mode,
    reason: check.reason,
    thresholds: Object.fromEntries(
      THRESHOLD_KEYS[gate].map((threshold) => [threshold, check[threshold]]),
    ),
    overrideIndices,
  };
}

/** The eight supported complexity/file-size source extensions, without scope or mode. */
export function isJsTsPath(path) {
  return /\.(?:[cm]?[jt]s|[jt]sx)$/u.test(repositoryPath(path));
}

// Discovery must reject symlinks and verify actual enabled coverage before scanning.
export function matchesScope(
  policy,
  gate,
  path,
  detectedFormat = formatForPath(path),
) {
  if (detectedFormat !== null && !supportedFormats.includes(detectedFormat))
    throw new ConfigurationError("Unsupported detected format");
  if (!matchesPathScope(policy, gate, path)) return false;
  const check = policy.checks[checkKey(gate)];
  return gate === "duplication"
    ? check.formats.includes(detectedFormat)
    : isJsTsPath(path);
}

/** Authored repository scope, independent of per-check modes and scopes. */
export function matchesGlobalScope(policy, path) {
  const normalized = repositoryPath(path);
  return (
    !matchesAny(normalized, [...HARD_EXCLUDES, ...GENERATED_EXCLUDES]) &&
    matchesAny(normalized, policy.scope.include) &&
    !matchesAny(normalized, policy.scope.exclude)
  );
}
/** Static scope only: no mode or source-format decision. */
export function matchesPathScope(policy, gate, path) {
  const normalized = repositoryPath(path);
  const check = policy.checks[checkKey(gate)];
  return (
    matchesGlobalScope(policy, normalized) &&
    matchesAny(normalized, check.include) &&
    !matchesAny(normalized, check.exclude)
  );
}
/** Differences contain resolved values, so deleting a config shows its return to defaults. */
export function diffPolicies(before, after) {
  const differences = [];
  function compare(left, right, path) {
    if (JSON.stringify(stable(left)) === JSON.stringify(stable(right))) return;
    if (
      left !== null &&
      right !== null &&
      !Array.isArray(left) &&
      !Array.isArray(right) &&
      typeof left === "object" &&
      typeof right === "object"
    ) {
      for (const key of [
        ...new Set([...Object.keys(left), ...Object.keys(right)]),
      ].sort()) {
        if (key !== "hash")
          compare(left[key], right[key], path ? `${path}.${key}` : key);
      }
    } else
      differences.push({ path, before: left ?? null, after: right ?? null });
  }
  compare(before, after, "");
  return differences;
}
