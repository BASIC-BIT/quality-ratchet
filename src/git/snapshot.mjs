import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { git, SetupError, resolveCommit } from "./commands.mjs";
import {
  enumerateSources,
  inspectPath,
  treeEntries,
  matchesSourceScope,
} from "./paths.mjs";
import {
  effectiveCheck,
  resolvePolicy,
  matchesGlobalScope,
  isJsTsPath,
} from "../config/resolve.mjs";
import { workingEolProvenance, canonicalGitEol } from "./eol.mjs";
import { reportSourceSelected } from "../reports/scope.mjs";
const gates = ["duplication", "complexity", "file-size"];
function selected(policy, path, repo, tree = null) {
  return (
    reportSourceSelected(policy, path) ||
    gates.some(
      (gate) =>
        effectiveCheck(policy, gate, path).mode !== "off" &&
        matchesSourceScope(policy, gate, path, repo, tree),
    )
  );
}
function copyTree(comparison, tree, destination, policy) {
  const candidates = enumerateSources(comparison, tree);
  const entries = tree
    ? new Map(
        treeEntries(comparison.repo, tree).map((entry) => [entry.path, entry]),
      )
    : null;
  const renamedDestinations = new Map(
    [...comparison.renames].map(([next, old]) => [old, next]),
  );
  const paths = [];
  for (const path of candidates) {
    if (!tree && inspectPath(comparison.repo, path))
      throw new SetupError("Source changed while preparing snapshot");
    const renamedDestination =
      tree === comparison.baselineSha ? renamedDestinations.get(path) : null;
    const renamedBaseline =
      renamedDestination &&
      isJsTsPath(path) &&
      matchesGlobalScope(policy, path) &&
      selected(policy, renamedDestination, comparison.repo, comparison.treeSha);
    if (!selected(policy, path, comparison.repo, tree) && !renamedBaseline)
      continue;
    const bytes = tree
      ? git(comparison.repo, ["cat-file", "blob", entries.get(path).hash], {
          encoding: null,
        })
      : readFileSync(join(comparison.repo, path));
    paths.push(path);
    mkdirSync(dirname(join(destination, path)), { recursive: true });
    writeFileSync(join(destination, path), bytes);
  }
  return { paths, excluded: candidates.excluded };
}
/** Exact source bytes only. No consumer executable configuration or Git metadata is copied. */
export function createSourceSnapshot(context) {
  if (context.comparison.workingTreeHash && !context.comparison.treeSha)
    assertWorkingIdentity(context.comparison);
  const root = mkdtempSync(join(tmpdir(), `quality-source-${process.pid}-`));
  try {
    const base = join(root, "base"),
      current = join(root, "current");
    mkdirSync(base);
    mkdirSync(current);
    const baseline = copyTree(
      context.comparison,
      context.comparison.baselineSha,
      base,
      context.policy,
    );
    const proposed = copyTree(
      context.comparison,
      context.comparison.treeSha,
      current,
      context.policy,
    );
    const eolProvenance = context.comparison.treeSha
      ? null
      : workingEolProvenance(context.comparison.repo, proposed.paths);
    if (context.comparison.workingTreeHash && !context.comparison.treeSha)
      assertWorkingIdentity(context.comparison);
    return {
      eolProvenance,
      root,
      base,
      current,
      paths: { base: baseline.paths, current: proposed.paths },
      excluded: { base: baseline.excluded, current: proposed.excluded },
      dispose() {
        rmSync(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
/** Comparison blobs/index writes stay isolated. Local projections use captured
 * Git EOL provenance; source snapshots and the consumer index keep raw bytes. */
export function writeSnapshotTree(
  repo,
  directory,
  paths,
  normalizeEolPaths = null,
) {
  git(repo, ["read-tree", "--empty"]);
  const records = paths
    .map((path) => {
      const bytes = readFileSync(join(directory, path));
      const hash = git(repo, ["hash-object", "--no-filters", "-w", "--stdin"], {
        input: normalizeEolPaths?.has(path) ? canonicalGitEol(bytes) : bytes,
      }).trim();
      return `100644 ${hash}\t${path}\0`;
    })
    .join("");
  git(repo, ["update-index", "-z", "--index-info"], { input: records });
  return git(repo, ["write-tree"]).trim();
}

export async function withSourceSnapshot(context, callback) {
  const snapshot = createSourceSnapshot(context);
  try {
    return await callback(snapshot);
  } finally {
    snapshot.dispose();
  }
}

function configBytes(repo) {
  const reason = inspectPath(repo, "quality-ratchet.json");
  if (reason === "deleted") return null;
  if (reason)
    throw new SetupError("quality-ratchet.json must be a regular file");
  return readFileSync(join(repo, "quality-ratchet.json"));
}
/** Length prefixes keep arbitrary path/content boundaries unambiguous. */
export function workingIdentity(
  comparison,
  directory = null,
  capturedPaths = null,
  capturedEolProvenance = null,
) {
  if (resolveCommit(comparison.repo, "HEAD") !== comparison.headSha)
    throw new SetupError("HEAD changed. Rerun the quality check.");
  const policy = resolvePolicy();
  const paths =
    capturedPaths ??
    enumerateSources(comparison, null).filter((path) =>
      selected(policy, path, comparison.repo),
    );
  const hash = createHash("sha256");
  function add(value) {
    const bytes = Buffer.from(value);
    hash.update(`${bytes.length}:`);
    hash.update(bytes);
  }
  add(comparison.headSha);
  add(
    (capturedEolProvenance ?? workingEolProvenance(comparison.repo, paths))
      .identity,
  );
  for (const path of [...paths].sort()) {
    if (path === "quality-ratchet.json") continue;
    add(path);
    add(readFileSync(join(directory ?? comparison.repo, path)));
  }
  add("quality-ratchet.json");
  const config = directory
    ? capturedPaths.includes("quality-ratchet.json")
      ? readFileSync(join(directory, "quality-ratchet.json"))
      : null
    : configBytes(comparison.repo);
  add(config === null ? "absent" : "present");
  if (config !== null) add(config);
  return hash.digest("hex");
}
export function assertWorkingIdentity(comparison) {
  if (workingIdentity(comparison) !== comparison.workingTreeHash)
    throw new SetupError(
      "Working source or quality-ratchet.json changed. Rerun the quality check.",
    );
}
