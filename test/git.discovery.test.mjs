import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withRepo, write, commit, git } from "./helpers/repo.mjs";
import { resolveComparison } from "../src/git/comparison.mjs";
import { resolvePolicy } from "../src/config/resolve.mjs";
import { listEligiblePaths } from "../src/git/paths.mjs";
import { withSourceSnapshot, workingIdentity } from "../src/git/snapshot.mjs";
import { scanDuplication } from "../src/duplication/scanner.mjs";
import { toolRoot, body } from "./helpers/duplication.mjs";

test("large excluded and unrouted blobs cannot break discovery, snapshots or freshness", async () =>
  withRepo(async (repo) => {
    const large = Buffer.alloc(65 * 1024 * 1024);
    write(repo, "build/archive.bin", large);
    write(repo, "assets/archive.bin", large);
    write(repo, "src/first.js", body("alpha"));
    commit(repo);
    write(repo, "src/second.js", body("beta"));
    const before = {
      status: git(
        repo,
        "--no-optional-locks",
        "status",
        "--porcelain=v1",
        "-uall",
      ),
      index: readFileSync(join(repo, ".git/index")),
      config: readFileSync(join(repo, ".git/config")),
    };
    const comparison = resolveComparison({ repo, base: "HEAD" });
    const context = { comparison, policy: resolvePolicy(), toolRoot };
    for (const gate of ["duplication", "complexity", "file-size"]) {
      assert.deepEqual(listEligiblePaths(context, gate), [
        "src/base.ts",
        "src/first.js",
        "src/second.js",
      ]);
      assert.deepEqual(
        listEligiblePaths(
          {
            ...context,
            comparison: { ...comparison, treeSha: comparison.baselineSha },
          },
          gate,
        ),
        ["src/base.ts", "src/first.js"],
      );
    }
    let location;
    await withSourceSnapshot(context, (snapshot) => {
      location = snapshot.root;
      assert.deepEqual(snapshot.paths.current, [
        "src/base.ts",
        "src/first.js",
        "src/second.js",
      ]);
    });
    assert.equal(existsSync(location), false);
    const report = await scanDuplication(context);
    assert.ok(report.findings.length);
    write(repo, "build/archive.bin", Buffer.alloc(65 * 1024 * 1024, 1));
    assert.equal(workingIdentity(comparison), comparison.workingTreeHash);
    write(repo, "build/archive.bin", large);
    assert.equal(
      git(repo, "--no-optional-locks", "status", "--porcelain=v1", "-uall"),
      before.status,
    );
    assert.deepEqual(readFileSync(join(repo, ".git/index")), before.index);
    assert.deepEqual(readFileSync(join(repo, ".git/config")), before.config);
  }));

import { matchesScope } from "../src/config/resolve.mjs";
import { matchesSourceScope } from "../src/git/paths.mjs";
import { gitBlobPrefix } from "../src/git/commands.mjs";

test("static path exclusions and gate modes precede shebang reads without changing scope semantics", async () =>
  withRepo(async (repo) => {
    const long = "#!/secret-interpreter " + "x".repeat(5000) + "\n";
    for (const path of [
      "build/skip",
      "assets/skip",
      "src/skip",
      "src/known.js",
    ])
      write(repo, path, long);
    const head = commit(repo);
    const policy = resolvePolicy({
      schemaVersion: 1,
      scope: { exclude: ["assets/**"] },
      checks: { duplication: { exclude: ["src/skip"] } },
    });
    for (const tree of [null, head]) {
      for (const path of ["build/skip", "assets/skip", "src/skip"])
        assert.equal(
          matchesSourceScope(policy, "duplication", path, repo, tree),
          false,
          path,
        );
      assert.equal(
        matchesSourceScope(policy, "duplication", "src/known.js", repo, tree),
        true,
      );
      for (const gate of ["complexity", "file-size"])
        assert.equal(
          matchesSourceScope(resolvePolicy(), gate, "src/skip", repo, tree),
          false,
        );
      const off = resolvePolicy({
        schemaVersion: 1,
        checks: { duplication: { mode: "off", reason: "measure other gates" } },
      });
      assert.equal(matchesScope(off, "duplication", "src/known.js"), true);
      assert.deepEqual(
        listEligiblePaths(
          { comparison: { repo, treeSha: tree }, policy: off },
          "duplication",
        ),
        [],
      );
    }
    let root;
    await withSourceSnapshot(
      { comparison: { repo, baselineSha: head, treeSha: null }, policy },
      (snapshot) => {
        root = snapshot.root;
        assert.deepEqual(snapshot.paths.base, ["src/base.ts", "src/known.js"]);
        assert.deepEqual(snapshot.paths.current, snapshot.paths.base);
      },
    );
    assert.equal(existsSync(root), false);
  }));

test("overlong unknown shebangs fail source-free for working and Git paths", async () =>
  withRepo(async (repo) => {
    write(repo, "script", "#!/secret-interpreter " + "x".repeat(5000) + "\n");
    const head = commit(repo);
    for (const tree of [null, head]) {
      assert.throws(
        () =>
          matchesSourceScope(
            resolvePolicy(),
            "duplication",
            "script",
            repo,
            tree,
          ),
        (error) => {
          assert.equal(error.exitCode, 2);
          assert.match(error.message, /bounded discovery prefix in "script"/);
          assert.doesNotMatch(error.message, /secret-interpreter|xxxxx/);
          return true;
        },
      );
    }
    assert.equal(gitBlobPrefix(repo, head + ":script", 4096).length, 4096);
    assert.throws(
      () => gitBlobPrefix(repo, head + ":absent", 4096),
      /Git cat-file failed/,
    );
  }));
