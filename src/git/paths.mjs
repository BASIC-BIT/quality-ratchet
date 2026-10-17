import { lstatSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { git, gitBlobPrefix, SetupError, verifyTree } from "./commands.mjs";
import {
  effectiveCheck,
  matchesScope,
  matchesPathScope,
} from "../config/resolve.mjs";
import { formatForPath } from "../duplication/formats.mjs";
export function sourcePath(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/u.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    (process.platform === "win32" && path.includes("\\"))
  )
    throw new SetupError("Invalid Git source path");
  return path;
}
export function treeEntries(repo, tree) {
  const sha = verifyTree(repo, tree);
  return git(repo, ["ls-tree", "-rz", "--full-tree", sha])
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const tab = record.indexOf("\t");
      const [mode, type, hash] = record.slice(0, tab).split(" ");
      return { mode, type, hash, path: sourcePath(record.slice(tab + 1)) };
    });
}
export function workingPaths(repo) {
  return [
    ...new Set(
      git(repo, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
      ])
        .split("\0")
        .filter(Boolean),
    ),
  ]
    .map((path) => sourcePath(path.replace(/\/$/u, "")))
    .sort();
}
export function inspectPath(repo, path) {
  const parts = sourcePath(path).split("/");
  for (let i = 0; i < parts.length; i++) {
    const absolute = join(repo, ...parts.slice(0, i + 1));
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return "deleted";
      throw error;
    }
    if (stat.isSymbolicLink()) return "symlink";
    if (stat.isDirectory() && existsSync(join(absolute, ".git")))
      return "nested-checkout";
    if (i === parts.length - 1 && !stat.isFile()) return "non-file";
  }
  return null;
}
function treeSources(repo, tree) {
  const entries = treeEntries(repo, tree);
  const nested = entries
    .filter((entry) => entry.mode === "160000")
    .map((entry) => entry.path);
  return entries.map((entry) => {
    if (entry.mode === "120000") return { path: entry.path, reason: "symlink" };
    const isNested =
      entry.type !== "blob" ||
      nested.some(
        (path) => entry.path === path || entry.path.startsWith(`${path}/`),
      );
    return { path: entry.path, reason: isNested ? "nested-checkout" : null };
  });
}
export function enumerateSources(comparison, tree = comparison.treeSha) {
  const entries = tree
    ? treeSources(comparison.repo, tree)
    : workingPaths(comparison.repo).map((path) => ({
        path,
        reason: inspectPath(comparison.repo, path),
      }));
  const paths = [],
    excluded = [];
  for (const entry of entries) {
    if (entry.reason) excluded.push(entry);
    else paths.push(entry.path);
  }
  Object.defineProperty(paths, "excluded", { value: excluded });
  return paths.sort();
}
/** Returned string[] has non-enumerable .excluded records for rejected filesystem entries. */
export function listEligiblePaths(context, gate) {
  const paths = enumerateSources(context.comparison);
  const eligible = paths.filter(
    (path) =>
      effectiveCheck(context.policy, gate, path).mode !== "off" &&
      matchesSourceScope(
        context.policy,
        gate,
        path,
        context.comparison.repo,
        context.comparison.treeSha,
      ),
  );
  Object.defineProperty(eligible, "excluded", { value: paths.excluded });
  return eligible;
}
export { assertRepository } from "./commands.mjs";

const SHEBANG_PREFIX_BYTES = 4096;
/** Unknown routes inspect a bounded prefix; recognized paths never read source here. */
export function matchesSourceScope(policy, gate, path, repo, tree = null) {
  if (!matchesPathScope(policy, gate, path)) return false;
  const format = formatForPath(path);
  if (gate !== "duplication" || format !== null)
    return matchesScope(policy, gate, path, format);
  let prefix;
  if (tree)
    prefix = gitBlobPrefix(
      repo,
      `${tree}:${sourcePath(path)}`,
      SHEBANG_PREFIX_BYTES,
    );
  else {
    const fd = openSync(join(repo, sourcePath(path)), "r");
    try {
      const bytes = Buffer.alloc(SHEBANG_PREFIX_BYTES);
      const size = readSync(fd, bytes, 0, bytes.length, 0);
      prefix = bytes.subarray(0, size);
    } finally {
      closeSync(fd);
    }
  }
  if (
    prefix[0] === 35 &&
    prefix[1] === 33 &&
    prefix.length === SHEBANG_PREFIX_BYTES &&
    !prefix.includes(10)
  )
    throw new SetupError(
      `Shebang exceeds bounded discovery prefix in ${JSON.stringify(path)}`,
    );
  return matchesScope(
    policy,
    gate,
    path,
    formatForPath(path, prefix.toString("utf8")),
  );
}
