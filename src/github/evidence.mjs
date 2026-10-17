import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const installedRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
/** Version evidence is descriptive; Task 8 supplies release-qualified verification. */
export function toolMetadata(verified) {
  const pkg = JSON.parse(
    readFileSync(join(installedRoot, "package.json"), "utf8"),
  );
  const scanners = {};
  for (const name of Object.keys(pkg.dependencies))
    scanners[name] = JSON.parse(
      readFileSync(
        join(installedRoot, "node_modules", name, "package.json"),
        "utf8",
      ),
    ).version;
  return {
    version: pkg.version,
    node: process.versions.node,
    scanners,
    verified: verified === true,
  };
}
export function writeEvidence({
  report,
  scanned,
  current,
  result,
  directory,
  tool = null,
}) {
  mkdirSync(directory, { recursive: true });
  const reportPath = join(directory, "quality-results.json"),
    evidencePath = join(directory, "quality-evidence.json");
  const revision = current
    ? {
        headSha: current.headSha,
        baseRef: current.baseRef,
        baseSha: current.baseSha,
        labels: current.labels,
      }
    : null;
  const missing = Object.entries({ report, scanned, current, tool })
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  const metadata = {
    schemaVersion: 1,
    tool,
    scanned,
    current: revision,
    result,
    missing,
  };
  writeFileSync(
    reportPath,
    JSON.stringify({ ...metadata, quality: report }, null, 2) + "\n",
  );
  writeFileSync(evidencePath, JSON.stringify(metadata, null, 2) + "\n");
  return { reportPath, evidencePath };
}
