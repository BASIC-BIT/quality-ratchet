import { lstatSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { git, SetupError, verifyTree } from "./commands.mjs";
import { effectiveCheck, matchesScope } from "../config/resolve.mjs";
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
export function enumerateSources(comparison, tree = comparison.treeSha) {
  const paths = [],
    excluded = [];
  if (tree) {
    const entries = treeEntries(comparison.repo, tree);
    const nested = entries
      .filter((entry) => entry.mode === "160000")
      .map((entry) => entry.path);
    for (const entry of entries) {
      const reason =
        entry.mode === "120000"
          ? "symlink"
          : entry.type !== "blob" ||
              nested.some(
                (path) =>
                  entry.path === path || entry.path.startsWith(`${path}/`),
              )
            ? "nested-checkout"
            : null;
      if (reason) excluded.push({ path: entry.path, reason });
      else paths.push(entry.path);
    }
  } else {
    for (const path of workingPaths(comparison.repo)) {
      const reason = inspectPath(comparison.repo, path);
      if (reason) excluded.push({ path, reason });
      else paths.push(path);
    }
  }
  Object.defineProperty(paths, "excluded", { value: excluded });
  return paths.sort();
}
/** Returned string[] has non-enumerable .excluded records for rejected filesystem entries. */
export function listEligiblePaths(context, gate) {
  const paths = enumerateSources(context.comparison);
  const eligible = paths.filter(
    (path) =>
      matchesScope(context.policy, gate, path) &&
      effectiveCheck(context.policy, gate, path).mode !== "off",
  );
  Object.defineProperty(eligible, "excluded", { value: paths.excluded });
  return eligible;
}
export function assertRepository(repo) {
  const actual = git(repo, ["rev-parse", "--show-toplevel"]).trim();
  if (resolve(actual) !== resolve(repo))
    throw new SetupError("repo must identify the repository root");
  return resolve(actual);
}
