import test from "node:test";
import assert from "node:assert/strict";
import { renameSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git, write, commit, withRepo } from "./helpers/repo.mjs";
import { treeComparison } from "../src/git/comparison.mjs";

test("large binary snapshot changes retain source ranges despite consumer diff attributes", () =>
  withRepo((repo) => {
    write(repo, ".gitattributes", "*.ts -diff\n*.png diff\n");
    const image = Buffer.alloc(33 * 1024 * 1024, "o");
    image[0] = 0;
    write(repo, "snapshots/large.png", image);
    write(repo, "src/original.ts", "export const retained = 1;\n");
    const baselineSha = commit(repo);
    image.fill("n");
    image[0] = 0;
    write(repo, "snapshots/large.png", image);
    write(repo, "src/base.ts", "export const base = 2;\n");
    write(repo, "src/added.ts", "export const added = 1;\n");
    renameSync(join(repo, "src/original.ts"), join(repo, "src/renamed.ts"));
    const headSha = commit(repo);
    const index = readFileSync(join(repo, ".git/index")),
      config = readFileSync(join(repo, ".git/config")),
      attributes = readFileSync(join(repo, ".gitattributes"));
    const beforeScratch = diffScratch();
    const comparison = treeComparison({
      repo,
      baselineSha,
      headSha,
      baseRef: "main",
      treeSha: git(repo, "rev-parse", "HEAD^{tree}"),
    });
    assert.deepEqual(diffScratch(), beforeScratch);
    assert.deepEqual(readFileSync(join(repo, ".git/index")), index);
    assert.deepEqual(readFileSync(join(repo, ".git/config")), config);
    assert.deepEqual(readFileSync(join(repo, ".gitattributes")), attributes);
    assert.deepEqual(comparison.ranges.get("src/base.ts"), [[1, 1]]);
    assert.equal(comparison.renames.get("src/renamed.ts"), "src/original.ts");
    assert.ok(comparison.renames.newPaths.has("src/added.ts"));
    assert.deepEqual(comparison.ranges.get("snapshots/large.png"), [[1, 1]]);
  }));

const diffScratch = () =>
  readdirSync(tmpdir()).filter((name) =>
    name.startsWith(`quality-diff-${process.pid}-`),
  );

test("diff preparation removes its scratch output after Git fails", () =>
  withRepo((repo) => {
    const head = git(repo, "rev-parse", "HEAD");
    git(repo, "config", "diff.algorithm", "invalid");
    const beforeScratch = diffScratch();
    assert.throws(
      () =>
        treeComparison({
          repo,
          baselineSha: head,
          headSha: head,
          baseRef: "main",
          treeSha: git(repo, "rev-parse", "HEAD^{tree}"),
        }),
      /Git diff failed/,
    );
    assert.deepEqual(diffScratch(), beforeScratch);
  }));
