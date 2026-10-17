import test from "node:test";

import assert from "node:assert/strict";

import { readFileSync, existsSync } from "node:fs";

import { join } from "node:path";

import { git, write, commit, withRepo } from "./helpers/repo.mjs";

import {
  resolveComparison,
  loadPolicySelection,
} from "../src/git/comparison.mjs";

import { listEligiblePaths } from "../src/git/paths.mjs";

import { withSourceSnapshot } from "../src/git/snapshot.mjs";

import { resolvePolicy } from "../src/config/resolve.mjs";

const context = (comparison) => ({
  comparison,
  policy: resolvePolicy(),
  toolRoot: process.cwd(),
});

test("local untracked copy is included without index mutation", () =>
  withRepo(async (repo) => {
    const before = git(repo, "write-tree");

    write(repo, "src/copy.ts", readFileSync(join(repo, "src/base.ts")));

    const comparison = resolveComparison({ repo, base: "HEAD" });

    assert.ok(comparison.ranges.has("src/copy.ts"));

    assert.ok(
      listEligiblePaths(context(comparison), "duplication").includes(
        "src/copy.ts",
      ),
    );

    let location;

    await withSourceSnapshot(context(comparison), (snapshot) => {
      location = snapshot.root;

      assert.equal(
        readFileSync(join(snapshot.current, "src/copy.ts"), "utf8"),
        "export const base = 1;\n",
      );

      assert.ok(!snapshot.root.startsWith(repo));
    });

    assert.equal(existsSync(location), false);

    assert.equal(git(repo, "write-tree"), before);
  }));

test("tracked ignored source remains included", () =>
  withRepo((repo) => {
    write(repo, ".gitignore", "src/base.ts\n");

    assert.ok(
      listEligiblePaths(
        context(resolveComparison({ repo, base: "HEAD" })),
        "complexity",
      ).includes("src/base.ts"),
    );
  }));

test("ignored scratch stays absent", () =>
  withRepo((repo) => {
    write(repo, ".gitignore", "scratch/\n");

    write(repo, "scratch/no.ts", "export const no = 1;\n");

    assert.ok(
      !listEligiblePaths(
        context(resolveComparison({ repo, base: "HEAD" })),
        "complexity",
      ).includes("scratch/no.ts"),
    );
  }));

test("non-JS duplication paths survive discovery", () =>
  withRepo((repo) => {
    for (const path of [
      "docs/a.md",
      "docs/a.mdx",
      "styles/a.css",
      "scripts/a.py",
      "scripts/a.sh",
      "settings/a.yaml",
    ])
      write(repo, path, "example\n");

    const ctx = context(resolveComparison({ repo, base: "HEAD" }));

    const paths = listEligiblePaths(ctx, "duplication");

    for (const path of [
      "docs/a.md",
      "docs/a.mdx",
      "styles/a.css",
      "scripts/a.py",
      "scripts/a.sh",
      "settings/a.yaml",
    ])
      assert.ok(paths.includes(path), path);

    assert.deepEqual(listEligiblePaths(ctx, "complexity"), ["src/base.ts"]);
  }));

test("malicious diff header content cannot retarget a hunk", () =>
  withRepo((repo) => {
    write(repo, "docs/a.md", "-- a/spoof.ts\nold\n");
    commit(repo);

    write(repo, "docs/a.md", "++ b/spoof.ts\nnew\n");

    const { ranges } = resolveComparison({ repo, base: "HEAD" });

    assert.ok(ranges.has("docs/a.md"));
    assert.equal(ranges.has("spoof.ts"), false);
  }));

test("explicit a/b prefixes override user diff settings", () =>
  withRepo((repo) => {
    git(repo, "config", "diff.noprefix", "true");
    git(repo, "config", "diff.mnemonicPrefix", "true");

    write(repo, "src/base.ts", "export const base = 2;\n");

    assert.deepEqual(
      resolveComparison({ repo, base: "HEAD" }).ranges.get("src/base.ts"),
      [[1, 1]],
    );
  }));

import {
  renameSync,
  rmSync,
  symlinkSync,
  mkdtempSync,
  readdirSync,
  chmodSync,
} from "node:fs";

import { tmpdir } from "node:os";

import {
  parseDiffPath,
  parseUnifiedDiff,
  parseRenameStatus,
} from "../src/git/diff.mjs";

import { treeEntries, workingPaths } from "../src/git/paths.mjs";

import { git as safeGit } from "../src/git/commands.mjs";
import { repositoryPath } from "../src/config/glob.mjs";

import { encodeScanContext, decodeScanContext } from "../src/contracts.mjs";

test("explicit local base uses merge-base even when the target advanced", () =>
  withRepo((repo) => {
    const common = git(repo, "rev-parse", "HEAD");

    git(repo, "checkout", "-qb", "feature");
    write(repo, "src/feature.ts", "export const feature = 1;\n");
    commit(repo);

    git(repo, "checkout", "main");
    write(repo, "src/target.ts", "export const target = 1;\n");
    const target = commit(repo);

    git(repo, "checkout", "feature");

    assert.notEqual(target, common);

    assert.equal(resolveComparison({ repo, base: "main" }).baselineSha, common);
  }));

test("prepared merges compare against the actual passed target parent", () =>
  withRepo((repo) => {
    git(repo, "checkout", "-qb", "feature");
    write(repo, "src/feature.ts", "export const feature = 1;\n");
    commit(repo);

    git(repo, "checkout", "main");
    write(repo, "src/target.ts", "export const target = 1;\n");
    const target = commit(repo);

    git(
      repo,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "merge",
      "--no-ff",
      "--no-edit",
      "feature",
    );

    const comparison = resolveComparison({ repo, base: target });

    assert.equal(comparison.baselineSha, target);

    assert.ok(comparison.ranges.has("src/feature.ts"));
    assert.ok(!comparison.ranges.has("src/target.ts"));
  }));

test("an ordinary local merge does not replace an explicitly selected merge-base", () =>
  withRepo((repo) => {
    const common = git(repo, "rev-parse", "HEAD");

    git(repo, "checkout", "-qb", "target");
    write(repo, "src/target.ts", "export const target = 1;\n");
    commit(repo);

    git(repo, "checkout", "main");
    write(repo, "src/main.ts", "export const main = 1;\n");
    commit(repo);

    git(repo, "checkout", "-qb", "side");
    write(repo, "src/side.ts", "export const side = 1;\n");
    commit(repo);

    git(repo, "checkout", "main");
    git(
      repo,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "merge",
      "--no-ff",
      "--no-edit",
      "side",
    );

    assert.equal(
      resolveComparison({ repo, base: "target" }).baselineSha,
      common,
    );
  }));

test("in-progress merge preserves its exact selected target parent", () =>
  withRepo((repo) => {
    git(repo, "checkout", "-qb", "feature");
    write(repo, "src/feature.ts", "export const feature = 1;\n");
    const feature = commit(repo);

    git(repo, "checkout", "main");
    write(repo, "src/target.ts", "export const target = 1;\n");
    commit(repo);

    git(
      repo,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "merge",
      "--no-commit",
      "--no-ff",
      "feature",
    );

    assert.equal(
      resolveComparison({ repo, base: feature }).baselineSha,
      feature,
    );
  }));

test("absent origin/HEAD requires --base, present symbolic origin/HEAD is used", () =>
  withRepo((repo) => {
    assert.throws(() => resolveComparison({ repo }), /--base/u);

    git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");

    git(
      repo,
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
      "refs/remotes/origin/main",
    );

    assert.equal(
      resolveComparison({ repo }).baseRef,
      "refs/remotes/origin/main",
    );
  }));

test("spaces and Unicode survive working-tree enumeration and snapshots", () =>
  withRepo(async (repo) => {
    for (const path of ["src/with space.ts", "src/café.ts"])
      write(repo, path, "export const value = 1;\n");

    const ctx = context(resolveComparison({ repo, base: "HEAD" }));

    for (const path of ["src/with space.ts", "src/café.ts"])
      assert.ok(ctx.comparison.ranges.has(path));

    await withSourceSnapshot(ctx, (snapshot) =>
      assert.ok(existsSync(join(snapshot.current, "src/café.ts"))),
    );
  }));

test("newlines and tabs survive real Git NUL tree transport on every host", () =>
  withRepo((repo) => {
    // Windows Git refuses these index/worktree paths, but tree objects retain them.

    const unusual = "with\nnewline\tand café.ts";

    const hash = git(repo, "rev-parse", "HEAD:src/base.ts");

    const { execFileSync } = process.getBuiltinModule("node:child_process");

    const tree = execFileSync("git", ["mktree", "-z"], {
      cwd: repo,
      input: `100644 blob ${hash}\t${unusual}\0`,
      encoding: "utf8",
      shell: false,
    }).trim();

    assert.ok(treeEntries(repo, tree).some((entry) => entry.path === unusual));

    const comparison = {
      ...resolveComparison({ repo, base: "HEAD" }),
      treeSha: tree,
    };

    assert.ok(
      listEligiblePaths(context(comparison), "complexity").includes(unusual),
    );

    assert.equal(repositoryPath(unusual), unusual);

    assert.equal(
      parseDiffPath('"b/with\\nnewline\\tand caf\\303\\251.ts"'),
      unusual,
    );

    if (process.platform !== "win32") {
      write(repo, unusual, "export const value = 2;\n");

      assert.ok(workingPaths(repo).includes(unusual));

      assert.ok(resolveComparison({ repo, base: "HEAD" }).ranges.has(unusual));
    }
  }));

test("repository paths allow tab/newline but still reject malformed identities", () => {
  assert.equal(repositoryPath("src/a\tb\nc.ts"), "src/a\tb\nc.ts");

  for (const path of [
    "../a.ts",
    "/a.ts",
    "C:/a.ts",
    "a/../b.ts",
    "a\0.ts",
    "a//b.ts",
  ])
    assert.throws(() => repositoryPath(path));
});

test("module, declaration and generated eligibility uses existing active policy", () =>
  withRepo((repo) => {
    for (const path of [
      "vite.config.mts",
      "src/run.cts",
      "src/a.test.ts",
      "src/A.stories.tsx",
      "src/api.d.ts",
      "src/api.d.mts",
      "src/api.d.cts",
      "generated/a.ts",
      "build/a.js",
    ])
      write(repo, path, "export const value = 1;\n");

    const paths = listEligiblePaths(
      context(resolveComparison({ repo, base: "HEAD" })),
      "complexity",
    );

    for (const path of [
      "vite.config.mts",
      "src/run.cts",
      "src/a.test.ts",
      "src/A.stories.tsx",
    ])
      assert.ok(paths.includes(path), path);

    for (const path of [
      "src/api.d.ts",
      "src/api.d.mts",
      "src/api.d.cts",
      "generated/a.ts",
      "build/a.js",
    ])
      assert.ok(!paths.includes(path), path);
  }));

test("filesystem and edited tracked renames retain baseline identities and deletion boundaries", () =>
  withRepo((repo) => {
    write(repo, "src/old.ts", "export const value = 1;\n".repeat(20));
    commit(repo);

    renameSync(join(repo, "src/old.ts"), join(repo, "src/new.ts"));

    let comparison = resolveComparison({ repo, base: "HEAD" });

    assert.equal(comparison.renames.get("src/new.ts"), "src/old.ts");

    assert.equal(comparison.renames.newPaths.has("src/new.ts"), false);

    write(
      repo,
      "src/new.ts",
      "// added header\n" + "export const value = 1;\n".repeat(20),
    );
    commit(repo);

    comparison = resolveComparison({ repo, base: "HEAD~1" });

    assert.equal(comparison.renames.get("src/new.ts"), "src/old.ts");

    assert.ok(
      comparison.renames.hunks
        .get("src/new.ts")
        .some((hunk) => hunk.newCount === 1),
    );

    write(
      repo,
      "src/new.ts",
      "// added header\n" + "export const value = 1;\n".repeat(19),
    );

    comparison = resolveComparison({ repo, base: "HEAD" });

    assert.ok(
      comparison.ranges.hunks
        .get("src/new.ts")
        .some((hunk) => hunk.newCount === 0),
    );
  }));

test("moving generated source into eligible scope is new source", () =>
  withRepo((repo) => {
    write(repo, "generated/old.ts", "export const value = 1;\n");
    commit(repo);

    renameSync(join(repo, "generated/old.ts"), join(repo, "src/new.ts"));

    const comparison = resolveComparison({ repo, base: "HEAD" });

    assert.equal(comparison.renames.has("src/new.ts"), false);

    assert.equal(comparison.renames.newPaths.has("src/new.ts"), true);
  }));

test("active policy stays baseline-owned through threshold, scope and deletion proposals", () =>
  withRepo((repo) => {
    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({
        schemaVersion: 1,
        checks: { complexity: { cyclomatic: 9 } },
      }),
    );
    const baselineSha = commit(repo);

    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({
        schemaVersion: 1,
        scope: { exclude: ["src/**"] },
        checks: { complexity: { cyclomatic: 99 } },
      }),
    );

    let selection = loadPolicySelection({ repo, baselineSha });

    assert.equal(selection.active.checks.complexity.cyclomatic, 9);
    assert.equal(selection.proposed.checks.complexity.cyclomatic, 99);
    assert.equal(selection.changed, true);

    rmSync(join(repo, "quality-ratchet.json"));
    selection = loadPolicySelection({ repo, baselineSha });

    assert.equal(selection.active.checks.complexity.cyclomatic, 9);
    assert.equal(selection.proposed.checks.complexity.cyclomatic, 15);

    write(repo, "quality-ratchet.json", "{broken");
    assert.throws(
      () => loadPolicySelection({ repo, baselineSha }),
      /valid JSON/u,
    );

    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({ schemaVersion: 1, unrecognized: true }),
    );
    assert.throws(
      () => loadPolicySelection({ repo, baselineSha }),
      /configuration/u,
    );
  }));

test("proposed policy can be loaded only from a verified full tree/commit object", () =>
  withRepo((repo) => {
    const baselineSha = git(repo, "rev-parse", "HEAD");

    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({
        schemaVersion: 1,
        checks: { fileSize: { maxLines: 800 } },
      }),
    );
    const currentTree = commit(repo);

    write(repo, "quality-ratchet.json", "invalid");

    assert.equal(
      loadPolicySelection({ repo, baselineSha, currentTree }).proposed.checks
        .fileSize.maxLines,
      800,
    );

    assert.throws(
      () => loadPolicySelection({ repo, baselineSha, currentTree: "HEAD" }),
      /full Git object SHA/u,
    );
  }));

test("snapshot excludes symlinks and nested checkouts with coverage evidence", () =>
  withRepo(async (repo) => {
    const external = mkdtempSync(join(tmpdir(), "quality-external-"));

    try {
      write(external, "outside.ts", "export const outside=1;\n");

      symlinkSync(
        external,
        join(repo, "linked"),
        process.platform === "win32" ? "junction" : "dir",
      );

      git(repo, "init", "-q", join(repo, "nested"));
      write(repo, "nested/a.ts", "export const nested=1;\n");

      const hash = git(repo, "rev-parse", "HEAD:src/base.ts");

      const { execFileSync } = process.getBuiltinModule("node:child_process");

      execFileSync(
        "git",
        [
          "update-index",
          "--add",
          "--cacheinfo",
          `100644,${hash},linked/outside.ts`,
        ],
        { cwd: repo, shell: false },
      );

      const ctx = context(resolveComparison({ repo, base: "HEAD" }));

      const paths = listEligiblePaths(ctx, "complexity");
      assert.ok(!paths.includes("linked/outside.ts"));
      assert.ok(!paths.includes("nested/a.ts"));

      assert.ok(paths.excluded.some((entry) => entry.reason === "symlink"));

      assert.ok(
        paths.excluded.some((entry) => entry.reason === "nested-checkout"),
      );

      await withSourceSnapshot(ctx, (snapshot) => {
        assert.ok(
          snapshot.excluded.current.some(
            (entry) => entry.reason === "nested-checkout",
          ),
        );
      });
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  }));

test("off modes and per-path re-enablement control actual source selection", () =>
  withRepo((repo) => {
    write(repo, "src/enabled.ts", "export const enabled=1;\n");

    const ctx = context(resolveComparison({ repo, base: "HEAD" }));

    ctx.policy = resolvePolicy({
      schemaVersion: 1,
      checks: { complexity: { mode: "off", reason: "only opted files" } },
      overrides: [
        {
          files: ["src/enabled.ts"],
          reason: "enable",
          checks: { complexity: { mode: "ratchet" } },
        },
      ],
    });

    assert.deepEqual(listEligiblePaths(ctx, "complexity"), ["src/enabled.ts"]);
  }));

test("scan transport preserves ranges, independent hunk maps, renames and new-path metadata", () =>
  withRepo((repo) => {
    write(repo, "src/copy.ts", "export const base = 1;\n");

    const ctx = context(resolveComparison({ repo, base: "HEAD" }));

    ctx.comparison.renames.set("src/rename.ts", "src/old.ts");

    ctx.comparison.renames.hunks = new Map([
      [
        "src/rename.ts",
        [{ oldStart: 1, oldCount: 2, newStart: 3, newCount: 4 }],
      ],
    ]);

    const decoded = decodeScanContext(encodeScanContext(ctx));

    assert.deepEqual(
      [...decoded.comparison.ranges],
      [...ctx.comparison.ranges],
    );

    assert.deepEqual(
      decoded.comparison.ranges.hunks,
      ctx.comparison.ranges.hunks,
    );

    assert.deepEqual(
      decoded.comparison.renames.hunks,
      ctx.comparison.renames.hunks,
    );

    assert.deepEqual(
      decoded.comparison.renames.newPaths,
      ctx.comparison.renames.newPaths,
    );

    assert.equal(decoded.comparison.ranges.renames, decoded.comparison.renames);

    assert.equal(decoded.policy.hash, ctx.policy.hash);

    const object = JSON.parse(encodeScanContext(ctx));

    object.policy.checks.complexity.cyclomatic = 999;

    assert.throws(() => decodeScanContext(JSON.stringify(object)), /identity/u);

    object.policy = ctx.policy;
    object.comparison.baselineSha = "--unsafe";

    assert.throws(() => decodeScanContext(JSON.stringify(object)), /identity/u);
  }));

test("hostile attributes, clean filters, fsmonitor, hooks, external diff and textconv never execute", () =>
  withRepo(async (repo) => {
    const sentinel = join(repo, "executed.txt");
    write(
      repo,
      "tripwire.cjs",
      `require("node:fs").appendFileSync(${JSON.stringify(sentinel)}, "executed\\n");`,
    );
    write(repo, ".gitattributes", "*.ts filter=hostile diff=hostile\n");
    commit(repo);
    const command = `node "${join(repo, "tripwire.cjs").replaceAll("\\", "/")}"`;
    for (const [key, value] of [
      ["filter.hostile.clean", command],
      ["filter.hostile.required", "true"],
      ["diff.hostile.command", command],
      ["diff.hostile.textconv", command],
      ["diff.external", command],
      ["core.fsmonitor", command],
      ["core.hooksPath", join(repo, "hooks")],
    ])
      git(repo, "config", key, value);
    write(repo, "hooks/post-index-change", `#!/bin/sh\n${command}\n`);
    chmodSync(join(repo, "hooks/post-index-change"), 0o755);
    const beforeIndex = readFileSync(join(repo, ".git/index"));
    const beforeConfig = readFileSync(join(repo, ".git/config"));
    const beforeTree = safeGit(repo, ["write-tree"]);
    write(repo, "src/base.ts", "export const changed = 2;\n");
    const beforeFile = readFileSync(join(repo, "src/base.ts"));
    const comparison = resolveComparison({ repo, base: "HEAD" });
    assert.deepEqual(comparison.ranges.get("src/base.ts"), [[1, 1]]);
    await withSourceSnapshot(context(comparison), (snapshot) => {
      assert.deepEqual(
        readFileSync(join(snapshot.current, "src/base.ts")),
        beforeFile,
      );
      assert.equal(existsSync(join(snapshot.current, ".gitattributes")), false);
    });
    assert.equal(
      existsSync(sentinel),
      false,
      "no executable consumer configuration may run",
    );
    assert.deepEqual(readFileSync(join(repo, ".git/index")), beforeIndex);
    assert.deepEqual(readFileSync(join(repo, ".git/config")), beforeConfig);
    assert.equal(safeGit(repo, ["write-tree"]), beforeTree);
    assert.deepEqual(readFileSync(join(repo, "src/base.ts")), beforeFile);
  }));

test("snapshot cleanup runs when a scanner callback rejects", () =>
  withRepo(async (repo) => {
    const ctx = context(resolveComparison({ repo, base: "HEAD" }));
    let root;
    await assert.rejects(
      withSourceSnapshot(ctx, async (snapshot) => {
        root = snapshot.root;
        throw new Error("scanner failed");
      }),
      /scanner failed/u,
    );
    assert.equal(existsSync(root), false);
  }));

test("snapshot setup errors remove temporary directories and leave consumer unchanged", () =>
  withRepo(async (repo) => {
    const ctx = context(resolveComparison({ repo, base: "HEAD" }));
    ctx.comparison.treeSha = "a".repeat(40);
    const before = readdirSync(tmpdir()).filter((path) =>
      path.startsWith("quality-source-"),
    );
    const index = readFileSync(join(repo, ".git/index"));
    await assert.rejects(
      withSourceSnapshot(ctx, () => assert.fail("must not scan")),
    );
    assert.deepEqual(
      readdirSync(tmpdir()).filter((path) =>
        path.startsWith("quality-source-"),
      ),
      before,
    );
    assert.deepEqual(readFileSync(join(repo, ".git/index")), index);
  }));

test("inherited parser handles quoted UTF-8, deletion boundaries and NUL rename records", () => {
  assert.equal(parseDiffPath('"b/caf\\303\\251.ts"'), "café.ts");
  assert.deepEqual(parseRenameStatus("R100\0src/old.ts\0src/new.ts\0"), [
    { oldPath: "src/old.ts", newPath: "src/new.ts" },
  ]);
  const ranges = parseUnifiedDiff(
    "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -5,2 +4,0 @@\n-gone\n",
  );
  assert.deepEqual(ranges.get("a.ts"), [[3, 4]]);
  assert.deepEqual(ranges.hunks.get("a.ts"), [
    { oldStart: 5, oldCount: 2, newStart: 4, newCount: 0 },
  ]);
});

test("intervening local source, config and HEAD changes require a fresh comparison", () =>
  withRepo(async (repo) => {
    let ctx = context(resolveComparison({ repo, base: "HEAD" }));
    const transported = decodeScanContext(encodeScanContext(ctx));
    assert.equal(
      transported.comparison.workingTreeHash,
      ctx.comparison.workingTreeHash,
    );
    write(repo, "src/base.ts", "export const base=2;\n");
    await assert.rejects(
      withSourceSnapshot(transported, () => assert.fail("stale source")),
      /Rerun/u,
    );
    ctx = context(resolveComparison({ repo, base: "HEAD" }));
    ctx.policy = resolvePolicy({
      schemaVersion: 1,
      scope: { include: ["src/**"] },
    });
    write(repo, "quality-ratchet.json", JSON.stringify({ schemaVersion: 1 }));
    await assert.rejects(
      withSourceSnapshot(ctx, () => assert.fail("stale config")),
      /Rerun/u,
    );
    ctx = context(resolveComparison({ repo, base: "HEAD" }));
    commit(repo);
    await assert.rejects(
      withSourceSnapshot(ctx, () => assert.fail("stale HEAD")),
      /Rerun/u,
    );
  }));

test("scan transport rejects malformed map metadata and escaping paths", () =>
  withRepo((repo) => {
    const encoded = encodeScanContext(
      context(resolveComparison({ repo, base: "HEAD" })),
    );
    for (const mutate of [
      (value) => (value.comparison.ranges = {}),
      (value) => (value.comparison.ranges = [["../escape.ts", [[1, 2]]]]),
      (value) => (value.comparison.ranges = [["src/base.ts", [[2, 1]]]]),
      (value) =>
        (value.comparison.rangeHunks = [
          [
            "src/base.ts",
            [{ oldStart: -1, oldCount: 1, newStart: 1, newCount: 1 }],
          ],
        ]),
      (value) => (value.comparison.newPaths = {}),
      (value) => (value.comparison.workingTreeHash = "bad"),
      (value) => (value.comparison.renames = [["src/a.ts", "../old.ts"]]),
    ]) {
      const value = JSON.parse(encoded);
      mutate(value);
      assert.throws(() => decodeScanContext(JSON.stringify(value)));
    }
  }));
