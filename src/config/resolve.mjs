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
import { formatForPath } from "../duplication/formats.mjs";

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

// Discovery must reject symlinks and verify actual enabled coverage before scanning.
export function matchesScope(policy, gate, path) {
  const key = checkKey(gate);
  const normalized = repositoryPath(path);
  const check = policy.checks[key];
  if (matchesAny(normalized, [...HARD_EXCLUDES, ...GENERATED_EXCLUDES]))
    return false;
  if (
    !matchesAny(normalized, policy.scope.include) ||
    matchesAny(normalized, policy.scope.exclude)
  )
    return false;
  const supported =
    gate === "duplication"
      ? check.formats.includes(formatForPath(normalized))
      : /\.(?:[cm]?[jt]s|[jt]sx)$/u.test(normalized);
  return (
    supported &&
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
