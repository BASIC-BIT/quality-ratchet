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
import { eventIdentity } from "./client.mjs";
const toolRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
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
    if (typeof token !== "string" || !token || /[\r\n\0]/u.test(token))
      throw new Error();
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
          `+refs/heads/${info.baseRef}:refs/quality/base`,
          `+refs/pull/${info.number}/head:refs/quality/head`,
        ],
        { env },
      );
    } finally {
      for (const key of Object.keys(env)) delete env[key];
    }
    const headSha = resolveCommit(root, "refs/quality/head"),
      baseSha = resolveCommit(root, "refs/quality/base");
    if (headSha !== info.headSha) throw new Error();
    git(root, ["update-ref", "HEAD", headSha]);
    const treeSha = git(root, [
      "merge-tree",
      "--write-tree",
      baseSha,
      headSha,
    ]).trim();
    verifyTree(root, treeSha);
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
      "PR comparison preparation failed. Rerun after checking the event, fetch, merge and configuration.",
    );
  }
}
/** Scanners read raw immutable objects, never a filter-populated working checkout. */
export function verifyPrepared({ context, scanned }) {
  const { comparison, selection } = context,
    repo = comparison.repo;
  if (
    resolveCommit(repo, "refs/quality/head") !== scanned.headSha ||
    resolveCommit(repo, "refs/quality/base") !== scanned.baseSha ||
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
