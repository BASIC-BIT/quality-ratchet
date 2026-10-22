import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runQuality } from "../runner.mjs";
import { validateQualityReport } from "../report.mjs";
import { preparePrComparison, verifyPrepared } from "./prepare.mjs";
import { eventIdentity, readCurrentPr } from "./client.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { writeEvidence, toolMetadata } from "./evidence.mjs";
import { renderSummary } from "./summary.mjs";
import { supportsNodeVersion } from "../runtime.mjs";
/** Task 8 calls this installed entrypoint after manifest/dependency verification. */
export async function runHosted({
  checkout,
  event,
  token,
  tempRoot,
  directory,
  toolVerified = false,
  transport,
  githubTransport,
}) {
  let prepared = null,
    report = null,
    current = null,
    scanned = null,
    tool = null;
  let result = {
    exitCode: 2,
    outcome: "error",
    rationale: null,
    message:
      "Quality preparation or execution failed. Evidence may be missing. Rerun the quality check.",
  };
  try {
    if (!supportsNodeVersion(process.versions.node)) throw new Error();
    tool = toolMetadata(toolVerified);
    if (toolVerified !== true) throw new Error();
    const info = eventIdentity(event);
    prepared = await preparePrComparison({
      checkout,
      event,
      token,
      tempRoot,
      transport,
    });
    scanned = prepared.scanned;
    verifyPrepared(prepared);
    report = await runQuality(prepared.context);
    verifyPrepared(prepared);
    validateQualityReport(report, prepared.context);
    current = await readCurrentPr({
      ...info,
      token,
      transport: githubTransport,
    });
    verifyPrepared(prepared);
    result = evaluatePolicy({ report, scanned, current, toolVerified });
  } catch {
    // Raw Git/API/parser errors can contain authentication or source text.
  } finally {
    prepared?.cleanup();
  }
  const input = { report, scanned, current, result, directory, tool };
  const paths = writeEvidence(input);
  writeFileSync(join(directory, "summary.md"), renderSummary(input));
  return { ...paths, report, scanned, current, result, tool };
}
