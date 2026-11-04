import { mkdtempSync, rmSync } from "node:fs";
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
 * Fetches the target tip and the PR head, then resolves their merge base.
 * Preparation and the post-scan staleness read both derive the baseline here,
 * from identical refspecs and the same merge-base command, so they cannot
 * disagree. The merge base is stable while the target branch moves; the target
 * tip is not. An unresolvable merge base fails instead of falling back.
 */
async function fetchRevisions({
  root,
  info,
  baseRef,
  token,
  transport,
  scope,
}) {
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
    const { headSha, baseTipSha, baseSha } = await fetchRevisions({
      root,
      info,
      baseRef: info.baseRef,
      token,
      transport,
      scope: "",
    });
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
    const scanned = {
      headSha,
      baseRef: info.baseRef,
      baseSha,
      baseTipSha,
      treeSha,
      configCommit: selection.configCommit,
      policyHash: selection.active.hash,
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
      "PR comparison preparation failed. Rerun after checking the event, fetch, merge base and configuration.",
    );
  }
}
/** Live baseline for the post-scan staleness check, fetched under separate refs. */
export async function readCurrentBaseline({
  prepared,
  info,
  baseRef,
  token,
  transport = git,
}) {
  const { baseSha } = await fetchRevisions({
    root: prepared.context.comparison.repo,
    info,
    baseRef,
    token,
    transport,
    scope: "current-",
  });
  return baseSha;
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
