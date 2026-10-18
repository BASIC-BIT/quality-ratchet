import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { effectiveCheck } from "../config/resolve.mjs";
import { scannerScope } from "./scope.mjs";
import { withSourceSnapshot } from "../git/snapshot.mjs";
import {
  candidates,
  verdicts,
  makeLinter,
  lintSource,
} from "../complexity/identity.mjs";
import { runScannerEntry } from "./entry.mjs";
const installedRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export async function scanComplexity(context) {
  const { comparison, policy } = context;
  return withSourceSnapshot(context, async (snapshot) => {
    const { files, baseline, metadata } = scannerScope(
      context,
      snapshot,
      "complexity",
    );
    const findings = [];
    const linter = files.length
      ? makeLinter(snapshot.current, context.toolRoot ?? installedRoot)
      : null;
    for (const file of files) {
      const check = effectiveCheck(policy, "complexity", file);
      const currentPath = join(snapshot.current, file);
      const head = await lintSource(
        linter,
        readFileSync(currentPath, "utf8"),
        currentPath,
      );
      const cands = candidates(
        head,
        comparison.ranges.get(file),
        check.thresholds,
      );
      if (!cands.length) continue;
      const basePath = comparison.renames.get(file) ?? file;
      // Use the destination extension/config for both revisions, including extension-changing renames.
      const base = baseline.has(basePath)
        ? await lintSource(
            linter,
            readFileSync(join(snapshot.base, basePath), "utf8"),
            currentPath,
          )
        : null;
      findings.push(
        ...verdicts(cands, base).map((f) => ({ file, ...f, ...check })),
      );
    }
    return {
      ...metadata,
      coverage: {
        ...metadata.coverage,
        limitations: [
          "anonymous-callbacks-use-source-order",
          "dynamic-computed-targets-use-anonymous-identities",
          "same-name-family-count-changes-are-new",
          "module-static-blocks-are-not-functions",
        ],
      },
      findings: findings.sort(
        (a, b) =>
          Math.max(b.cyclomatic, b.cognitive) -
          Math.max(a.cyclomatic, a.cognitive),
      ),
    };
  });
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await runScannerEntry("complexity", scanComplexity);
