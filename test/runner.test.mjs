import test from "node:test";
import assert from "node:assert/strict";
import { withRepo } from "./helpers/repo.mjs";
import {
  runContext,
  measuredResults,
  regressionSources,
  rawResult,
} from "./helpers/process.mjs";
import {
  combineResults,
  parseScannerResult,
  runQuality,
} from "../src/runner.mjs";
import { validateQualityReport } from "../src/report.mjs";

test("validated real findings combine ratchet, advisory, and disabled policy", async () =>
  withRepo(async (repo) => {
    regressionSources(repo);
    const context = runContext(repo, {
      checks: {
        complexity: { mode: "advisory", reason: "rollout" },
        fileSize: { mode: "off", reason: "size paused" },
      },
    });
    const results = await measuredResults(context);
    results[2] = {
      name: "file-size",
      state: "disabled",
      exitCode: null,
      report: null,
      error: null,
      coverage: {
        policyHash: context.selection.active.hash,
        eligibleFiles: 0,
        reason: "off-by-policy",
      },
    };
    const report = combineResults(results, context);
    assert.equal(report.strictExitCode, 1);
    assert.equal(validateQualityReport(report, context), report);
    const clean = structuredClone(results);
    clean[0].report.findings = [];
    clean[0].exitCode = 0;
    assert.equal(combineResults(clean, context).strictExitCode, 0);
    clean[1] = {
      name: "complexity",
      state: "error",
      exitCode: 2,
      report: null,
      error: "Scanner process failed",
    };
    assert.equal(combineResults(clean, context).strictExitCode, 2);
    for (const mutate of [
      (r) => r.scanners.pop(),
      (r) => (r.strictExitCode = 0),
      (r) => (r.scanners[0].report.policyHash = "0".repeat(64)),
      (r) => (r.scanners[0].report.findings[0].mode = "off"),
      (r) => (r.scanners[0].exitCode = 0),
      (r) => (r.scanners[0].report.source = "secret"),
      (r) => (r.scanners[0].report.currentClones[0].ae = -1),
    ]) {
      const bad = structuredClone(report);
      mutate(bad);
      assert.throws(() => validateQualityReport(bad, context));
    }
    const fake = structuredClone(report);
    fake.scanners[0] = { ...results[2], name: "duplication" };
    assert.throws(() => validateQualityReport(fake, context));
    for (const raw of [
      { ...rawResult(results[0].report, 1), signal: "SIGTERM" },
      { status: null, error: { code: "ETIMEDOUT" } },
      rawResult(results[0].report, 0),
      { ...rawResult(results[0].report, 1), stdout: "{" },
    ])
      assert.equal(parseScannerResult("duplication", raw, context).exitCode, 2);
  }));

test("all-advisory is successful with explicit zero blocking coverage", async () =>
  withRepo(async (repo) => {
    regressionSources(repo);
    const checks = Object.fromEntries(
      ["duplication", "complexity", "fileSize"].map((key) => [
        key,
        { mode: "advisory", reason: "rollout" },
      ]),
    );
    const report = await runQuality(runContext(repo, { checks }));
    assert.equal(report.strictExitCode, 0);
    assert.equal(report.coverage.blockingFiles, 0);
    assert.ok(report.coverage.enabledFiles > 0);
    assert.ok(report.scanners[0].report.findings.length > 0);
  }));

test("wholly empty actual coverage is operational failure", async () =>
  withRepo(async (repo) => {
    const result = await runQuality(
      runContext(repo, { scope: { include: ["missing/**"] } }),
    );
    assert.equal(result.strictExitCode, 2);
  }));

test("real child timeout, signal, and bounded output are operational failures", async () =>
  withRepo(async (repo) => {
    const context = runContext(repo);
    const { runNode } = await import("../src/runner.mjs");
    const { join } = await import("node:path");
    for (const mode of ["timeout", "signal", "overflow", "invalid"]) {
      const raw = runNode(
        join(context.toolRoot, "test/fixtures/process.mjs"),
        JSON.stringify({ mode }),
        { timeout: mode === "timeout" ? 100 : 5000, maxBuffer: 1024 },
      );
      if (mode === "timeout") assert.equal(raw.error.code, "ETIMEDOUT");
      if (mode === "signal") {
        if (process.platform === "win32") {
          assert.equal(raw.status, 1);
          assert.equal(raw.signal, null);
        } else assert.equal(raw.signal, "SIGTERM");
      }
      if (mode === "overflow") assert.equal(raw.error.code, "ENOBUFS");
      if (mode === "invalid") assert.equal(raw.status, 0);
      const result = parseScannerResult("duplication", raw, context);
      assert.equal(result.exitCode, 2, mode);
      assert.equal(result.report, null);
      assert.doesNotMatch(result.error, /not JSON|xxxxx/);
    }
  }));

test("overrides cannot turn empty actual coverage into successful checks", async () =>
  withRepo(async (repo) => {
    const off = { mode: "off", reason: "paused" };
    const context = runContext(repo, {
      checks: { duplication: off, complexity: off, fileSize: off },
      overrides: [
        {
          files: ["missing/**"],
          reason: "only selected package",
          checks: { complexity: { mode: "advisory" } },
        },
      ],
    });
    const report = await runQuality(context);
    assert.equal(report.strictExitCode, 2);
    assert.ok(report.scanners.every((scan) => scan.state === "disabled"));
    assert.equal(report.coverage.enabledFiles, 0);
  }));

test("enabled overrides and advisory parser errors both reach the runner", async () =>
  withRepo(async (repo) => {
    const { write } = await import("./helpers/repo.mjs");
    write(repo, "src/broken.ts", "function broken( { SOURCE_SECRET");
    const off = { mode: "off", reason: "paused" };
    const context = runContext(repo, {
      checks: { duplication: off, complexity: off, fileSize: off },
      overrides: [
        {
          files: ["src/**"],
          reason: "rollout",
          checks: { complexity: { mode: "advisory" } },
        },
      ],
    });
    const report = await runQuality(context);
    assert.equal(report.strictExitCode, 2);
    assert.equal(report.scanners[1].state, "error");
    assert.equal(report.coverage.blockingFiles, 0);
    assert.doesNotMatch(JSON.stringify(report), /SOURCE_SECRET/);
  }));

test("valid measured reports reject missing fields, invalid thresholds, and diagnostic failure downgrades", async () =>
  withRepo(async (repo) => {
    regressionSources(repo);
    const context = runContext(repo, { checks: { fileSize: { maxLines: 5 } } });
    const report = combineResults(await measuredResults(context), context);
    assert.deepEqual(
      report.scanners.map((scan) => scan.exitCode),
      [1, 1, 1],
    );
    for (const mutate of [
      (r) => (r.scanners[0].report.findings[0].as = 0),
      (r) => (r.scanners[0].report.findings[0].tokens = "50"),
      (r) => (r.scanners[1].report.findings[0].baseCyclomatic = 1),
      (r) => (r.scanners[1].report.findings[0].end = 999999),
      (r) => (r.scanners[1].report.findings[0].thresholds.cyclomatic = 999),
      (r) => r.scanners[2].report.findings[0].lines++,
      (r) => r.scanners[2].report.findings[0].overrideIndices.push(7),
      (r) => r.advisories.testSize.data.files++,
      (r) => r.advisories.testDebt.data.exactClonePairs++,
      (r) => (r.scanners[1] = r.scanners[0]),
      (r) => (r.policy.active.hash = "f".repeat(64)),
    ]) {
      const bad = structuredClone(report);
      mutate(bad);
      assert.throws(() => validateQualityReport(bad, context), String(mutate));
    }
    const failed = structuredClone(report);
    failed.advisories.testSize = {
      ...failed.advisories.testSize,
      state: "error",
      data: null,
      error: "Enabled diagnostic report failed",
    };
    assert.throws(() => validateQualityReport(failed, context));
    failed.strictExitCode = 2;
    assert.equal(validateQualityReport(failed, context).strictExitCode, 2);
  }));

for (const language of ["javascript", ""]) {
  test(`native Markdown container format ${language || "text"} validates against its source route`, async () =>
    withRepo(async (repo) => {
      const { write } = await import("./helpers/repo.mjs");
      const { body } = await import("./fixtures/duplication/bodies.mjs");
      const fence = "`".repeat(3);
      write(
        repo,
        "docs/first.md",
        `${fence}${language}\n${body("first")}\n${fence}\n`,
      );
      write(
        repo,
        "docs/second.md",
        `${fence}${language}\n${body("second")}\n${fence}\n`,
      );
      const context = runContext(repo, {
        checks: {
          duplication: {
            mode: "advisory",
            reason: "docs rollout",
            formats: ["markdown"],
          },
          complexity: { mode: "off", reason: "docs only" },
          fileSize: { mode: "off", reason: "docs only" },
        },
      });
      const report = await runQuality(context);
      assert.equal(report.strictExitCode, 0);
      const duplication = report.scanners[0].report;
      assert.ok(duplication.currentClones.length > 0);
      assert.equal(duplication.currentClones[0].aFormat, language || "text");
      assert.deepEqual(duplication.coverage.limitations, [
        "markdown-prose-requires-fenced-tokens",
      ]);
    }));
}
