import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveComparison } from "../../src/git/comparison.mjs";
import { resolvePolicy } from "../../src/config/resolve.mjs";
export const toolRoot = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);
export const scanContext = (repo, input = {}, base = "HEAD") => ({
  comparison: resolveComparison({ repo, base }),
  policy: resolvePolicy({ schemaVersion: 1, ...input }),
  toolRoot,
});
export function git(repo, ...args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    shell: false,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
  }).trim();
}
export function write(repo, path, text) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}
export function commit(repo, message = "fixture") {
  git(repo, "add", "--all");
  git(
    repo,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--no-verify",
    "-qm",
    message,
  );
  return git(repo, "rev-parse", "HEAD");
}
export async function withRepo(callback) {
  const repo = mkdtempSync(join(tmpdir(), "quality-git-test-"));
  try {
    git(repo, "init", "-q", "--initial-branch=main");
    write(repo, "src/base.ts", "export const base = 1;\n");
    commit(repo);
    return await callback(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}
