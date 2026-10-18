import test from "node:test";
import assert from "node:assert/strict";
import { withRepo, write } from "./helpers/repo.mjs";
import { runContext } from "./helpers/process.mjs";
import { collectTestSourceInventory } from "../src/reports/test-size.mjs";
import { summarizeTestDebt } from "../src/reports/test-debt.mjs";

test("enabled size inventory survives every check off for its test paths", async () =>
  withRepo(async (repo) => {
    write(repo, "test/b.ts", "a\r\nb\r\nc\r\n");
    write(repo, "test/a.ts", "a\nb\nc\n");
    const context = runContext(repo, {
      checks: {
        duplication: { exclude: ["test/**"] },
        complexity: { exclude: ["test/**"] },
        fileSize: { mode: "off", reason: "paused" },
      },
      reports: { testSize: { oversizedLines: 3 } },
    });
    const { testSize: inventory } = await collectTestSourceInventory({
      ...context,
      policy: context.selection.active,
    });
    assert.equal(inventory.files, 2);
    assert.equal(inventory.lines, 6);
    assert.deepEqual(
      inventory.oversizedFiles.map((f) => f.path),
      ["test/a.ts", "test/b.ts"],
    );
  }));

test("test debt counts endpoints and deterministically ranks overlapping spans", () => {
  const rows = [
    { a: "test/a.ts", as: 1, ae: 10, b: "test/a.ts", bs: 20, be: 29 },
    { a: "test/a.ts", as: 40, ae: 44, b: "src/a.ts", bs: 1, be: 5 },
    { a: "card.stories.tsx", as: 1, ae: 8, b: "b.spec.ts", bs: 2, be: 9 },
    { a: "src/a.ts", as: 20, ae: 30, b: "src/b.ts", bs: 20, be: 30 },
  ];
  const report = summarizeTestDebt(rows, { files: 0, lines: 0 });
  assert.deepEqual(
    [
      report.exactClonePairs,
      report.testInvolvedPairs,
      report.testToTestPairs,
      report.testToSourcePairs,
      report.sameFilePairs,
      report.crossFilePairs,
    ],
    [4, 3, 2, 1, 1, 2],
  );
  assert.deepEqual(
    report.hotspots.map((f) => f.path),
    ["test/a.ts", "b.spec.ts", "card.stories.tsx"],
  );
  assert.equal(report.hotspots[0].participatingLines, 25);
  assert.match(report.caveat, /overlap/);
});

test("diagnostic views keep distinct scanner scopes and disabled settings", async () =>
  withRepo(async (repo) => {
    write(repo, "test/size-only.ts", "// size\n");
    write(repo, "test/debt-only.ts", "// debt\n");
    write(repo, "test/excluded.ts", "// excluded\n");
    const context = runContext(repo, {
      scope: { exclude: ["test/excluded.ts"] },
      checks: {
        duplication: { exclude: ["test/size-only.ts"] },
        fileSize: { exclude: ["test/debt-only.ts"] },
      },
    });
    const inventory = collectTestSourceInventory({
      ...context,
      policy: context.selection.active,
    });
    assert.deepEqual(
      inventory.testSize.entries.map((row) => row.path),
      ["test/size-only.ts"],
    );
    assert.deepEqual(
      inventory.testDebt.entries.map((row) => row.path),
      ["test/debt-only.ts"],
    );
    const disabled = runContext(repo, {
      reports: { testDebt: false, testSize: { enabled: false } },
    });
    assert.deepEqual(
      collectTestSourceInventory({
        ...disabled,
        policy: disabled.selection.active,
      }),
      { testSize: null, testDebt: null },
    );
  }));

test("test/support classification retains stories, E2E support, and fixture modules", async () => {
  const { isTestSourcePath } = await import("../src/reports/scope.mjs");
  for (const path of [
    "tests/example.test.ts",
    "apps/e2e/visualSupport.ts",
    "ui/card.stories.tsx",
    "lib/testExampleFixtures.ts",
  ])
    assert.equal(isTestSourcePath(path), true, path);
  assert.equal(isTestSourcePath("src/main.ts"), false);
});
