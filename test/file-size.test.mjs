import assert from "node:assert/strict";
import { test } from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  scanFileSize,
  physicalLines,
  classify,
} from "../src/scanners/file-size.mjs";
import { encodeScanContext } from "../src/contracts.mjs";
import {
  withRepo,
  write,
  commit,
  git,
  scanContext as context,
  toolRoot,
} from "./helpers/repo.mjs";
import { lines } from "./fixtures/functions/bodies.mjs";
const scan = (repo, input = {}, base = "HEAD") =>
  scanFileSize(context(repo, input, base));

test("physical lines ignore terminal newline and support empty, LF, CRLF and CR", () => {
  for (const [text, count] of [
    ["", 0],
    ["a", 1],
    ["a\n", 1],
    ["a\r\nb\r\n", 2],
    ["a\nb", 2],
    ["a\rb\r", 2],
    ["\n\n", 2],
  ])
    assert.equal(physicalLines(text), count);
});
test("size classification preserves exclusive cap and non-growing debt", () => {
  assert.equal(classify("f.ts", 999, null, 1000), null);
  assert.equal(classify("f.ts", 1000, null, 1000).verdict, "NEW");
  assert.equal(classify("f.ts", 1000, 999, 1000).verdict, "GREW");
  assert.equal(classify("f.ts", 1251, 1250, 1000).verdict, "GREW");
  assert.equal(classify("f.ts", 1220, 1250, 1000), null);
  assert.equal(classify("f.ts", 1250, 1250, 1000), null);
});
for (const [before, after, expected] of [
  [999, 1000, "GREW"],
  [1250, 1220, null],
  [1250, 1251, "GREW"],
  [1250, 1250, null],
]) {
  test(`size ${before} to ${after}`, () =>
    withRepo(async (repo) => {
      write(repo, "src/a.ts", lines(before));
      commit(repo);
      write(repo, "src/a.ts", lines(after));
      const report = await scan(repo);
      assert.equal(report.findings[0]?.verdict ?? null, expected);
      if (expected)
        assert.deepEqual(
          [report.findings[0].lines, report.findings[0].baseLines],
          [after, before],
        );
    }));
}
test("new cap, eight JS/TS extensions, tests/stories/fixtures and generated exclusions", () =>
  withRepo(async (repo) => {
    for (const ext of ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"])
      write(repo, `test/a.${ext}`, lines(1000));
    for (const path of [
      "src/a.stories.ts",
      "test/fixtures/a.ts",
      "scripts/root.mjs",
    ])
      write(repo, path, lines(1000));
    for (const path of [
      "src/a.d.mts",
      "src/a.d.cts",
      "node_modules/a.ts",
      "build/a.ts",
    ])
      write(repo, path, lines(1000));
    write(repo, "scripts/extensionless", "#!/usr/bin/env node\n" + lines(1000));
    const report = await scan(repo);
    assert.equal(report.findings.length, 11);
    assert.equal(report.coverage.eligibleFiles, 12);
    assert.ok(
      report.findings.every((f) => f.verdict === "NEW" && f.mode === "ratchet"),
    );
  }));
test("overlapping package/test overrides use 1500 cap and retain metadata", () =>
  withRepo(async (repo) => {
    write(repo, "packages/web/a.ts", lines(1000));
    write(repo, "packages/web/test/a.test.ts", lines(1500));
    const report = await scan(repo, {
      overrides: [
        {
          files: ["packages/web/**"],
          reason: "package rollout",
          checks: { fileSize: { maxLines: 1200 } },
        },
        {
          files: ["**/*.test.ts"],
          reason: "large test inventory",
          checks: { fileSize: { mode: "advisory", maxLines: 1500 } },
        },
      ],
    });
    assert.equal(report.findings.length, 1);
    const f = report.findings[0];
    assert.deepEqual(
      [f.file, f.mode, f.overrideIndices, f.thresholds, f.reason],
      [
        "packages/web/test/a.test.ts",
        "advisory",
        [0, 1],
        { maxLines: 1500 },
        "large test inventory",
      ],
    );
  }));
test("globally off size can be enabled in a package; off coverage remains explicit", () =>
  withRepo(async (repo) => {
    write(repo, "src/off.ts", lines(1000));
    write(repo, "packages/on/a.ts", lines(1000));
    const report = await scan(repo, {
      checks: { fileSize: { mode: "off", reason: "staged adoption" } },
      overrides: [
        {
          files: ["packages/on/**"],
          reason: "first package",
          checks: { fileSize: { mode: "ratchet" } },
        },
      ],
    });
    assert.deepEqual(
      report.findings.map((f) => f.file),
      ["packages/on/a.ts"],
    );
    assert.ok(report.coverage.disabled.some((f) => f.path === "src/off.ts"));
  }));
test("recognized rename measures baseline under destination cap even when old scope off", () =>
  withRepo(async (repo) => {
    write(repo, "src/old.ts", lines(1250));
    const base = commit(repo);
    git(repo, "mv", "src/old.ts", "src/new.ts");
    write(repo, "src/new.ts", lines(1251));
    const report = await scan(
      repo,
      {
        checks: {
          duplication: { mode: "off", reason: "test scope" },
          complexity: { mode: "off", reason: "test scope" },
        },
        overrides: [
          {
            files: ["src/old.ts"],
            reason: "old off",
            checks: { fileSize: { mode: "off" } },
          },
          {
            files: ["src/new.ts"],
            reason: "destination",
            checks: { fileSize: { maxLines: 1200 } },
          },
        ],
      },
      base,
    );
    assert.equal(report.findings[0].verdict, "GREW");
    assert.equal(report.findings[0].baseLines, 1250);
    assert.deepEqual(report.findings[0].overrideIndices, [1]);
  }));
test("deleted oversized files produce no findings", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", lines(1250));
    commit(repo);
    rmSync(join(repo, "src/a.ts"));
    assert.equal((await scan(repo)).findings.length, 0);
  }));
test("file-size entry shares stdin/report and measured advisory exit", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", lines(1000));
    const ctx = context(repo, {
      checks: { fileSize: { mode: "advisory", reason: "rollout" } },
    });
    const result = spawnSync(
      process.execPath,
      [join(toolRoot, "src/scanners/file-size.mjs")],
      { input: encodeScanContext(ctx), encoding: "utf8" },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).findings[0].mode, "advisory");
  }));

test("size rename from check-excluded authored source keeps baseline; global exclusion is new", () =>
  withRepo(async (repo) => {
    write(repo, "legacy/old.ts", lines(1250));
    const base = commit(repo);
    git(repo, "mv", "legacy/old.ts", "src/new.ts");
    write(repo, "src/new.ts", lines(1251));
    const input = {
      checks: {
        duplication: { mode: "off", reason: "test scope" },
        complexity: { mode: "off", reason: "test scope" },
        fileSize: { exclude: ["legacy/**"] },
      },
    };
    const report = await scan(repo, input, base);
    assert.equal(report.findings[0].verdict, "GREW");
    assert.equal(report.findings[0].baseLines, 1250);
    const promoted = await scan(
      repo,
      { ...input, scope: { exclude: ["legacy/**"] } },
      base,
    );
    assert.equal(promoted.findings[0].verdict, "NEW");
  }));

for (const extension of ["py", "unknown"]) {
  test(`unsupported extension .${extension} promoted to .ts remains new size debt`, () =>
    withRepo(async (repo) => {
      const old = `legacy/old.${extension}`;
      write(repo, old, lines(1250));
      const base = commit(repo);
      git(repo, "mv", old, "src/new.ts");
      const ctx = context(repo, {}, base);
      if (extension === "py")
        assert.equal(ctx.comparison.renames.get("src/new.ts"), old);
      else ctx.comparison.renames.set("src/new.ts", old);
      const report = await scanFileSize(ctx);
      assert.equal(report.findings.length, 1);
      assert.equal(report.findings[0].verdict, "NEW");
      assert.equal(report.findings[0].baseLines, null);
      assert.equal(report.coverage.baselineFiles, 1);
    }));
}
