import { mkdtempSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  git,
  resolveCommit,
  verifyTree,
  SetupError,
} from "../git/commands.mjs";
import { assertRepository } from "../git/paths.mjs";
import { loadPolicySelection, treeComparison } from "../git/comparison.mjs";
import { eventIdentity, validRef } from "./client.mjs";
const toolRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
/**
 * Delivers the target tip and the PR head under the scope's refs.
 * Preparation and the post-scan staleness read use identical refspecs, so they
 * cannot disagree. A failure here is transport and may be retried.
 */
async function fetchRefs({ root, info, baseRef, token, transport, scope }) {
  if (typeof token !== "string" || !token || /[\r\n\0]/u.test(token))
    throw new Error();
  if (!validRef(baseRef)) throw new Error();
  const env = {
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from("x-access-token:" + token).toString("base64")}`,
    GIT_CONFIG_KEY_1: "credential.helper",
    GIT_CONFIG_VALUE_1: "",
  };
  try {
    await transport(
      root,
      [
        "fetch",
        "--no-tags",
        "--no-recurse-submodules",
        "--",
        `https://github.com/${info.owner}/${info.repo}.git`,
        `+refs/heads/${baseRef}:refs/quality/${scope}base`,
        `+refs/pull/${info.number}/head:refs/quality/${scope}head`,
      ],
      { env },
    );
  } finally {
    for (const key of Object.keys(env)) delete env[key];
  }
}
/**
 * Resolves the refs a fetch delivered, from the same merge-base command in both
 * scopes. The merge base is stable while the target branch moves; the target tip
 * is not. A failure here is not transport: the objects arrived and their merge
 * base does not exist, so the target branch itself changed.
 */
function resolveRevisions(root, scope) {
  const headSha = resolveCommit(root, `refs/quality/${scope}head`),
    baseTipSha = resolveCommit(root, `refs/quality/${scope}base`);
  return {
    headSha,
    baseTipSha,
    baseSha: resolveCommit(
      root,
      git(root, ["merge-base", baseTipSha, headSha]).trim(),
    ),
  };
}
/**
 * The policy at a target tip, or null when that tip's configuration does not
 * resolve. The tip is the one policy input no pull-request gate validates, so a
 * configuration this tool rejects can reach the target branch. Reading it must
 * never abort a run: the merge base and the head tree both parsed, so the scan
 * is valid, and failing here would abandon a completed scan over a condition
 * only a direct push to the target branch can repair. A null hash is never a
 * difference by itself; the report falls back to the other tip read, and only
 * two null hashes leave divergence unjudgeable.
 *
 * Only the tip decides this hash. Passing the pull-request head tree as the
 * proposed policy would make an author-controlled file throw here (invalid
 * JSON, a symlinked quality-ratchet.json, an unknown gate, a future
 * schemaVersion), and a null hash silences the divergence report. Preparation
 * happens to reject such a head first, so that was never reachable, but the
 * read must not depend on another check's ordering. active.hash is read from
 * the tip commit either way, so the reported hash is unchanged.
 */
export function readTipPolicyHash({ repo, tipSha }) {
  try {
    return loadPolicySelection({
      repo,
      baselineSha: tipSha,
      currentTree: tipSha,
    }).active.hash;
  } catch {
    // Recorded as an unresolved tip policy; raw errors can carry source text.
    return null;
  }
}
/** Transport changes network delivery in fixtures; all preparation remains real Git. */
export async function preparePrComparison({
  checkout,
  event,
  token,
  tempRoot,
  transport = git,
}) {
  let root;
  try {
    const info = eventIdentity(event);
    checkout = assertRepository(checkout);
    if (resolveCommit(checkout, "HEAD") !== info.headSha) throw new Error();
    root = mkdtempSync(join(tempRoot, "quality-pr-"));
    git(root, ["init", "-q", "--template="]);
    await fetchRefs({
      root,
      info,
      baseRef: info.baseRef,
      token,
      transport,
      scope: "",
    });
    const { headSha, baseTipSha, baseSha } = resolveRevisions(root, "");
    if (headSha !== info.headSha) throw new Error();
    git(root, ["update-ref", "HEAD", headSha]);
    const treeSha = verifyTree(root, headSha);
    git(root, ["update-ref", "refs/quality/tree", treeSha]);
    const comparison = treeComparison({
      repo: root,
      baselineSha: baseSha,
      headSha,
      baseRef: info.baseRef,
      treeSha,
    });
    const selection = loadPolicySelection({
      repo: root,
      baselineSha: baseSha,
      currentTree: treeSha,
    });
    // The tip policy observed while scanning. Enforcement reads the merge base,
    // so without a tip policy a branch point predating the policy silently
    // enforces an older one, or the defaults, and nothing reports that the
    // target branch has moved on. The divergence report compares the tip
    // observed after the scan; this one records what the tip held during it.
    const baseTipPolicyHash = readTipPolicyHash({
      repo: root,
      tipSha: baseTipSha,
    });
    const scanned = {
      headSha,
      baseRef: info.baseRef,
      baseSha,
      baseTipSha,
      treeSha,
      configCommit: selection.configCommit,
      policyHash: selection.active.hash,
      baseTipPolicyHash,
    };
    const prepared = {
      context: { comparison, selection, toolRoot },
      scanned,
      cleanup() {
        rmSync(root, { recursive: true, force: true });
      },
    };
    verifyPrepared(prepared);
    return prepared;
  } catch {
    if (root) rmSync(root, { recursive: true, force: true });
    throw new SetupError(
      "PR comparison preparation failed. Check the event, fetch, merge base and configuration. A rerun clears a transport failure, but not a target branch rewritten to unrelated history under the same name: that leaves no merge base to compare and must be repaired on the branch.",
    );
  }
}
/** Distinguishes a flaky post-scan read from missing or contradictory evidence. */
export class PostScanTransportError extends Error {}
const attempts = 2,
  // Throttling and name resolution, the conditions a retry targets, do not
  // clear within the time an immediate second attempt takes.
  retryDelayMs = 1_000;
async function delivered(options) {
  try {
    await fetchRefs(options);
    return true;
  } catch {
    // Transport only; raw Git errors can carry secrets, so none propagates.
    return false;
  }
}
/**
 * The post-scan target tip and merge base, fetched under separate refs. An
 * absent merge base is reported as `{baseSha: null}`: the refs arrived and the
 * target branch was force-pushed to unrelated history under the same name,
 * which is a permanent branch-state change rather than a flaky read, so it is
 * reported as an absent baseline rather than as a failed post-scan read. No
 * rerun clears it either way: preparation then finds no merge base and the run
 * reports `error`, so the branch state is what the report must name.
 */
function resolveCurrentRevisions(root) {
  try {
    const { baseSha, baseTipSha } = resolveRevisions(root, "current-");
    return { baseSha, baseTipSha };
  } catch {
    return { baseSha: null, baseTipSha: null };
  }
}
/**
 * Live baseline for the post-scan staleness check, fetched under separate refs.
 * One bounded retry: this fetch runs after the scan, so a transient failure
 * must not discard a completed verdict behind a generic preparation error. Only
 * delivery is retried.
 */
export async function readCurrentBaseline({
  prepared,
  info,
  baseRef,
  token,
  transport = git,
}) {
  const root = prepared.context.comparison.repo;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (
      await delivered({
        root,
        info,
        baseRef,
        token,
        transport,
        scope: "current-",
      })
    )
      return resolveCurrentRevisions(root);
    if (attempt < attempts) await sleep(retryDelayMs);
  }
  throw new PostScanTransportError();
}
/** Scanners read raw immutable objects, never a filter-populated working checkout. */
export function verifyPrepared({ context, scanned }) {
  const { comparison, selection } = context,
    repo = comparison.repo;
  if (
    resolveCommit(repo, "refs/quality/head") !== scanned.headSha ||
    resolveCommit(repo, "refs/quality/base") !== scanned.baseTipSha ||
    resolveCommit(repo, scanned.baseSha) !== scanned.baseSha ||
    verifyTree(repo, git(repo, ["rev-parse", "refs/quality/tree"]).trim()) !==
      scanned.treeSha ||
    comparison.treeSha !== scanned.treeSha ||
    comparison.baselineSha !== scanned.baseSha ||
    comparison.headSha !== scanned.headSha ||
    comparison.baseRef !== scanned.baseRef ||
    selection.configCommit !== scanned.configCommit ||
    selection.active.hash !== scanned.policyHash
  )
    throw new SetupError("Prepared source changed. Rerun the quality check.");
  git(repo, ["fsck", "--no-reflogs", "--no-dangling"]);
}
