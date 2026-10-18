import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toolManifest } from "../tool-manifest.mjs";
const installedRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
/** Descriptive manifest; only the isolated bootstrap establishes verification. */
export function toolMetadata(verified) {
  return { ...toolManifest(installedRoot), verified: verified === true };
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
