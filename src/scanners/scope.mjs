import {
  effectiveCheck,
  matchesScope,
  isJsTsPath,
} from "../config/resolve.mjs";
import { enumerateSources } from "../git/paths.mjs";

/** Shared scope and report metadata for the two JS/TS measurement gates. */
export function scannerScope({ comparison, policy }, snapshot, gate) {
  const enabled = (path) =>
    matchesScope(policy, gate, path) &&
    effectiveCheck(policy, gate, path).mode !== "off";
  const current = snapshot.paths.current.filter(enabled);
  const files = current.filter((path) => comparison.ranges.has(path));
  const renamedDestinations = new Map(
    [...comparison.renames].map(([next, old]) => [old, next]),
  );
  const baselinePaths = snapshot.paths.base.filter(isJsTsPath);
  return {
    files,
    baseline: new Set(baselinePaths),
    metadata: {
      base: comparison.baseRef ?? comparison.baselineSha,
      mergeBase: comparison.baselineSha,
      policyHash: policy.hash,
      changedFiles: files.length,
      scanned: files.length,
      coverage: {
        eligibleFiles: current.length,
        baselineFiles: baselinePaths.filter((path) =>
          enabled(renamedDestinations.get(path) ?? path),
        ).length,
        excluded: snapshot.excluded,
        disabled: enumerateSources(comparison)
          .filter(
            (path) =>
              matchesScope(policy, gate, path) &&
              effectiveCheck(policy, gate, path).mode === "off",
          )
          .map((path) => ({ path, ...effectiveCheck(policy, gate, path) })),
      },
    },
  };
}
