import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runQuality } from "../runner.mjs";
import { validateQualityReport } from "../report.mjs";
import {
  preparePrComparison,
  readCurrentBaseline,
  readTipPolicyHash,
  verifyPrepared,
  PostScanTransportError,
} from "./prepare.mjs";
import { eventIdentity, readCurrentPr } from "./client.mjs";
import { evaluatePolicy } from "./policy.mjs";
import { writeEvidence, toolMetadata } from "./evidence.mjs";
import { renderSummary } from "./summary.mjs";
import { supportsNodeVersion } from "../runtime.mjs";
/**
 * Live pull-request metadata, the post-scan merge base, and the policy at the
 * target tip as it stands after the scan.
 *
 * The tip policy is resolved here rather than at preparation time because
 * merging into the target branch moves neither the head nor the merge base: a
 * policy tightening that lands while the scan runs leaves every other check
 * equal, so only this read can see it. An unresolved tip policy is recorded, not
 * blocked, and leaves the verdict to compare the tip policy observed while
 * scanning.
 *
 * A retarget is already stale from baseRef alone, and the new target may share
 * no history, so its merge base is not resolved at all.
 */
async function readCurrentRevision({
  prepared,
  live,
  scanned,
  info,
  token,
  transport,
}) {
  const absent = { baseSha: null, baseTipSha: null };
  const { baseSha, baseTipSha } =
    live.baseRef === scanned.baseRef
      ? await readCurrentBaseline({
          prepared,
          info,
          baseRef: live.baseRef,
          token,
          transport,
        })
      : absent;
  const baseTipPolicyHash =
    baseTipSha === null
      ? null
      : readTipPolicyHash({
          repo: prepared.context.comparison.repo,
          tipSha: baseTipSha,
          treeSha: scanned.treeSha,
        });
  return {
    ...live,
    baseSha,
    baseTipSha,
    baseTipPolicyHash,
    baseTipPolicyUnreadable: baseTipSha !== null && baseTipPolicyHash === null,
  };
}
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
    const live = await readCurrentPr({
      ...info,
      token,
      transport: githubTransport,
    });
    current = await readCurrentRevision({
      prepared,
      live,
      scanned,
      info,
      token,
      transport,
    });
    verifyPrepared(prepared);
    result = evaluatePolicy({ report, scanned, current, toolVerified });
  } catch (error) {
    // Raw Git/API/parser errors can contain authentication or source text.
    if (error instanceof PostScanTransportError)
      result = {
        exitCode: 2,
        outcome: "error",
        rationale: null,
        message:
          "The scan completed but the post-scan baseline could not be read after a retry. Rerun the quality check.",
      };
  } finally {
    prepared?.cleanup();
  }
  const input = { report, scanned, current, result, directory, tool };
  const paths = writeEvidence(input);
  writeFileSync(join(directory, "summary.md"), renderSummary(input));
  return { ...paths, report, scanned, current, result, tool };
}
