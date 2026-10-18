// Adapted from generic Perkcord test-debt reporting; see docs/provenance.md.
import { isTestPath, comparePaths } from "./scope.mjs";
export function summarizeTestDebt(rows, inventory) {
  const hotspots = new Map();
  let testInvolvedPairs = 0,
    testToTestPairs = 0,
    sameFilePairs = 0;
  for (const row of rows) {
    const aTest = isTestPath(row.a),
      bTest = isTestPath(row.b);
    if (!aTest && !bTest) continue;
    testInvolvedPairs++;
    if (aTest && bTest) testToTestPairs++;
    if (row.a === row.b) sameFilePairs++;
    for (const side of ["a", "b"]) {
      const path = row[side];
      if (!isTestPath(path)) continue;
      const item = hotspots.get(path) ?? {
        path,
        occurrences: 0,
        participatingLines: 0,
      };
      item.occurrences++;
      item.participatingLines += row[`${side}e`] - row[`${side}s`] + 1;
      hotspots.set(path, item);
    }
  }
  const ordered = [...hotspots.values()].sort(
    (a, b) =>
      b.participatingLines - a.participatingLines ||
      b.occurrences - a.occurrences ||
      comparePaths(a.path, b.path),
  );
  return {
    exactClonePairs: rows.length,
    testInvolvedPairs,
    testToTestPairs,
    testToSourcePairs: testInvolvedPairs - testToTestPairs,
    sameFilePairs,
    crossFilePairs: testInvolvedPairs - sameFilePairs,
    hotspotFileCount: ordered.length,
    hotspots: ordered.slice(0, 15),
    source: inventory,
    caveat:
      "Clone ranges can overlap; participating lines are not removable-line estimates. Excluded paths are not covered.",
  };
}
