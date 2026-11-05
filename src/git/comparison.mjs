import {
  mkdirSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { StringDecoder } from "node:string_decoder";
import { join } from "node:path";
import {
  git,
  tryGit,
  resolveCommit,
  verifyTree,
  SetupError,
} from "./commands.mjs";
import { assertRepository, inspectPath, treeEntries } from "./paths.mjs";
import {
  createSourceSnapshot,
  writeSnapshotTree,
  workingIdentity,
  assertWorkingIdentity,
} from "./snapshot.mjs";
import { parseUnifiedDiff, parseRenameStatus } from "./diff.mjs";
import { resolvePolicy, diffPolicies } from "../config/resolve.mjs";
import { ConfigurationError } from "../config/validate.mjs";
/** Local --base uses merge-base. An in-progress merge can use its exact target parent. */
export function resolveComparison({ repo, base }) {
  repo = assertRepository(repo);
  const headSha = resolveCommit(repo, "HEAD");
  const baseRef =
    base ??
    tryGit(repo, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  if (!baseRef)
    throw new SetupError(
      "No origin/HEAD is available. Pass --base <ref> explicitly.",
    );
  const target = resolveCommit(repo, baseRef);
  const mergeHead = tryGit(repo, [
    "rev-parse",
    "--verify",
    "MERGE_HEAD^{commit}",
  ]);
  const baselineSha =
    mergeHead && (target === headSha || target === mergeHead)
      ? target
      : git(repo, ["merge-base", target, headSha]).trim();
  const comparison = {
    repo,
    baselineSha,
    headSha,
    baseRef,
    treeSha: null,
    ranges: new Map(),
    renames: new Map(),
  };
  const snapshot = createSourceSnapshot({
    comparison,
    policy: resolvePolicy(),
  });
  try {
    const isolated = join(snapshot.root, "git");
    mkdirSync(isolated);
    git(isolated, ["init", "-q", "--template="]);
    const before = writeSnapshotTree(
      isolated,
      snapshot.base,
      snapshot.paths.base,
    );
    const after = writeSnapshotTree(
      isolated,
      snapshot.current,
      snapshot.paths.current,
      snapshot.eolProvenance?.normalizePaths,
    );
    Object.assign(comparison, comparisonDiff(isolated, before, after));
    comparison.workingTreeHash = workingIdentity(
      comparison,
      snapshot.current,
      snapshot.paths.current,
      snapshot.eolProvenance,
    );
    assertWorkingIdentity(comparison);
    return comparison;
  } finally {
    snapshot.dispose();
  }
}
function readPolicy(repo, tree) {
  let text;
  if (tree) {
    const entry = treeEntries(repo, verifyTree(repo, tree)).find(
      (entry) => entry.path === "quality-ratchet.json",
    );
    if (!entry) return resolvePolicy();
    if (entry.type !== "blob" || entry.mode === "120000")
      throw new ConfigurationError(
        "quality-ratchet.json must be a regular file",
      );
    text = git(repo, ["cat-file", "blob", entry.hash]);
  } else {
    const reason = inspectPath(repo, "quality-ratchet.json");
    if (reason === "deleted") return resolvePolicy();
    if (reason)
      throw new ConfigurationError(
        "quality-ratchet.json must be a regular file",
      );
    text = readFileSync(join(repo, "quality-ratchet.json"), "utf8");
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ConfigurationError("quality-ratchet.json is not valid JSON");
  }
  return resolvePolicy(parsed);
}
/** currentTree is omitted for working files, or a verified full commit/tree SHA. */
export function loadPolicySelection({ repo, baselineSha, currentTree = null }) {
  repo = assertRepository(repo);
  const configCommit = resolveCommit(repo, baselineSha);
  if (currentTree !== null) verifyTree(repo, currentTree);
  const active = readPolicy(repo, configCommit),
    proposed = readPolicy(repo, currentTree);
  const diff = diffPolicies(active, proposed);
  return { active, proposed, configCommit, changed: diff.length !== 0, diff };
}

// Keep forced-text hunks without buffering binary bodies or trusting consumer attributes.
function* readDiffHeaders(path) {
  const file = openSync(path, "r"),
    buffer = Buffer.alloc(64 * 1024),
    decoder = new StringDecoder("utf8");
  let line = "",
    discard = false,
    inHunk = false,
    size;
  const isHeader = () =>
    line.startsWith("diff --git ") ||
    line.startsWith("@@ ") ||
    (!inHunk && (line.startsWith("--- ") || line.startsWith("+++ ")));
  const append = (part) => {
    if (discard) return;
    line += part;
    if (line.length < "diff --git ".length || isHeader()) return;
    discard = true;
    line = "";
  };
  const finishLine = () => {
    const header = !discard && isHeader() ? line : null;
    if (header?.startsWith("diff --git ")) inHunk = false;
    if (header?.startsWith("@@ ")) inHunk = true;
    line = "";
    discard = false;
    return header;
  };
  try {
    do {
      size = readSync(file, buffer);
      const parts = (
        size ? decoder.write(buffer.subarray(0, size)) : decoder.end()
      ).split("\n");
      for (const [index, part] of parts.entries()) {
        append(part);
        if (index === parts.length - 1 && size !== 0) continue;
        const header = finishLine();
        if (header !== null) yield header;
      }
    } while (size !== 0);
  } finally {
    closeSync(file);
  }
}

function comparisonDiff(isolated, before, after) {
  const options = [
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
    "--text",
    "--find-renames",
    "--src-prefix=a/",
    "--dst-prefix=b/",
  ];
  const directory = mkdtempSync(join(tmpdir(), `quality-diff-${process.pid}-`));
  let ranges;
  try {
    const path = join(directory, "changes.diff");
    git(isolated, [
      "diff",
      ...options,
      "--unified=0",
      "--diff-filter=d",
      `--output=${path}`,
      before,
      after,
      "--",
    ]);
    ranges = parseUnifiedDiff(readDiffHeaders(path));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const status = git(isolated, [
    "diff",
    ...options,
    "--name-status",
    "-z",
    before,
    after,
    "--",
  ]);
  const renames = new Map();
  renames.hunks = ranges.hunks;
  renames.newPaths = new Set();
  for (const { oldPath, newPath } of parseRenameStatus(status)) {
    renames.set(newPath, oldPath);
    ranges.set(newPath, [[1, Number.MAX_SAFE_INTEGER]]);
  }
  const parts = status.split("\0");
  for (let i = 0; i < parts.length;) {
    const state = parts[i++];
    if (!state) continue;
    const path = parts[i++];
    if (state.startsWith("R") || state.startsWith("C")) i++;
    if (state === "A") renames.newPaths.add(path);
  }
  ranges.renames = renames;
  return { ranges, renames };
}

/** Hosted comparison is against the merge base of the exact fetched refs. */
export function treeComparison({
  repo,
  baselineSha,
  headSha,
  baseRef,
  treeSha,
}) {
  resolveCommit(repo, baselineSha);
  resolveCommit(repo, headSha);
  verifyTree(repo, treeSha);
  return {
    repo,
    baselineSha,
    headSha,
    baseRef,
    treeSha,
    ...comparisonDiff(repo, baselineSha, treeSha),
  };
}
