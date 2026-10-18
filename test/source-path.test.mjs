import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { git, write, withRepo, toolRoot } from "./helpers/repo.mjs";
import { withHostedRepo } from "./helpers/hosted.mjs";
import { git as safeGit } from "../src/git/commands.mjs";
import { treeEntries, workingPaths, sourcePath } from "../src/git/paths.mjs";
import { repositoryPath } from "../src/config/glob.mjs";
import { resolvePolicy, matchesScope } from "../src/config/resolve.mjs";
import { loadPolicySelection } from "../src/git/comparison.mjs";
import { runHosted } from "../src/github/cli.mjs";

const deceptivePaths = ["node_modules\\new.ts", "src\\new.ts"];
function literalTree(repo, path) {
  const blob = git(repo, "rev-parse", "HEAD:src/base.ts");
  const directory = git(repo, "rev-parse", "HEAD:src");
  return safeGit(repo, ["mktree", "-z"], {
    input: `040000 tree ${directory}\tsrc\0` + `100644 blob ${blob}\t${path}\0`,
  }).trim();
}
function treeCommit(repo, tree) {
  return git(
    repo,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit-tree",
    tree,
    "-p",
    "HEAD",
    "-m",
    "literal Git filename",
  );
}
const cli = (repo) =>
  spawnSync(
    process.execPath,
    [
      join(toolRoot, "bin/quality-ratchet.mjs"),
      "check",
      "--base",
      "HEAD",
      "--repo",
      repo,
      "--json",
    ],
    { encoding: "utf8", windowsHide: true },
  );

test("literal backslashes cannot change Git identity under dependency or authored scope", () => {
  const policy = resolvePolicy({
    schemaVersion: 1,
    scope: { include: ["src/**"] },
  });
  for (const path of deceptivePaths) {
    for (const read of [
      sourcePath,
      repositoryPath,
      (value) => matchesScope(policy, "file-size", value),
    ])
      assert.throws(() => read(path), { name: "SetupError", exitCode: 2 });
  }
  assert.equal(matchesScope(policy, "file-size", "src/new.ts"), true);
  assert.equal(
    repositoryPath("src/tab\tnewline\n.ts"),
    "src/tab\tnewline\n.ts",
  );
});
test("real NUL Git trees reject literal backslashes before policy selection and CLI success", async () => {
  for (const path of deceptivePaths)
    await withRepo((repo) => {
      const tree = literalTree(repo, path);
      assert.ok(
        safeGit(repo, ["ls-tree", "-rz", tree]).includes(`\t${path}\0`),
      );
      assert.throws(() => treeEntries(repo, tree), {
        name: "SetupError",
        exitCode: 2,
      });
      assert.throws(
        () =>
          loadPolicySelection({ repo, baselineSha: "HEAD", currentTree: tree }),
        { name: "SetupError", exitCode: 2 },
      );
      git(repo, "update-ref", "HEAD", treeCommit(repo, tree));
      const run = cli(repo);
      assert.equal(run.status, 2, run.stdout + run.stderr);
      assert.match(JSON.parse(run.stdout).error, /Git source path/);
      assert.doesNotMatch(run.stdout + run.stderr, /export const base/);
    });
});
test("prepared hosted trees fail operationally for literal backslash identities", async () => {
  for (const path of deceptivePaths)
    await withHostedRepo(async (input) => {
      const head = treeCommit(
        input.checkout,
        literalTree(input.checkout, path),
      );
      git(input.checkout, "update-ref", "refs/heads/probe", head);
      git(input.checkout, "symbolic-ref", "HEAD", "refs/heads/probe");
      git(input.checkout, "update-ref", "refs/pull/7/head", head);
      input.event.pull_request.head.sha = head;
      const saved = await runHosted(input);
      assert.equal(saved.result.exitCode, 2);
      assert.equal(saved.result.outcome, "error");
      assert.equal(saved.report, null);
    });
});
test("POSIX working-tree backslashes fail before a clean or ignored result", async () => {
  if (process.platform === "win32") return;
  for (const path of deceptivePaths)
    await withRepo((repo) => {
      write(repo, path, "export const hidden = 2;\n");
      assert.throws(() => workingPaths(repo), {
        name: "SetupError",
        exitCode: 2,
      });
      const run = cli(repo);
      assert.equal(run.status, 2, run.stdout + run.stderr);
      assert.match(JSON.parse(run.stdout).error, /Git source path/);
    });
});
