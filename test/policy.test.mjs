import test, { before } from "node:test";
import assert from "node:assert/strict";
import { withRepo } from "./helpers/repo.mjs";
import { runContext, regressionSources } from "./helpers/process.mjs";
import { runQuality } from "../src/runner.mjs";
import { extractRationale, evaluatePolicy } from "../src/github/policy.mjs";
let input;
before(async () =>
  withRepo(async (repo) => {
    regressionSources(repo);
    const context = runContext(repo);
    const report = await runQuality(context);
    const scanned = {
      headSha: context.comparison.headSha,
      baseSha: context.comparison.baselineSha,
      baseTipSha: context.comparison.baselineSha,
      baseRef: "HEAD",
      treeSha: context.comparison.headSha,
      configCommit: report.policy.configCommit,
      policyHash: report.policy.active.hash,
      baseTipPolicyHash: report.policy.active.hash,
    };
    input = {
      report,
      scanned,
      current: {
        ...scanned,
        labels: ["quality-exception"],
        body: "## Quality exception\nDeliberate boundary.",
      },
      toolVerified: true,
    };
  }),
);
test("comment-only rationale cannot waive regression", () => {
  for (const body of [
    "## Quality exception\n<!-- Explain -->",
    "## Quality exception\n<!-- unfinished",
  ])
    assert.equal(
      evaluatePolicy({ ...input, current: { ...input.current, body } }).outcome,
      "invalid-exception",
    );
});
test("fenced heading is not a real section", () => {
  assert.equal(
    extractRationale("~~~md\n## Quality exception\nexample\n~~~"),
    null,
  );
  assert.equal(extractRationale("## quality exception\nWrong case."), null);
  assert.equal(
    extractRationale(
      "## Quality exception\r\nReason.\r\n### Detail\r\nMore.\r\n## Next\r\nOutside.",
    ),
    "Reason.\n### Detail\nMore.",
  );
  const literal = "$(echo should-never-run); `literal`";
  assert.equal(extractRationale("## Quality exception\n" + literal), literal);
});
test("Setext/indented section boundaries end the rationale", () => {
  for (const heading of [
    "  ## Summary",
    "   # Summary",
    "##",
    "Summary\n=======",
    "Summary\n  -------",
  ]) {
    const body =
      "## Quality exception\n<!-- Template -->\n\n" +
      heading +
      "\nUnrelated summary.";
    assert.equal(extractRationale(body), null, heading);
    assert.equal(
      extractRationale(
        "## Quality exception\nReason.\n\n" + heading + "\nOther.",
      ),
      "Reason.",
      heading,
    );
  }
});
test("accepted exception retains findings and current metadata controls pushes", () => {
  const before = JSON.stringify(input.report);
  assert.equal(evaluatePolicy(input).outcome, "exception");
  assert.equal(JSON.stringify(input.report), before);
  assert.equal(
    evaluatePolicy({ ...input, current: { ...input.current, labels: [] } })
      .outcome,
    "regression",
  );
  for (const change of [
    { headSha: "a".repeat(40) },
    { baseSha: "b".repeat(40) },
    { baseRef: "other" },
  ])
    assert.equal(
      evaluatePolicy({ ...input, current: { ...input.current, ...change } })
        .outcome,
      "stale",
    );
  assert.equal(
    evaluatePolicy({
      ...input,
      scanned: { ...input.scanned, baseTipSha: "c".repeat(40) },
    }).outcome,
    "exception",
  );
});
test("a divergent target policy blocks under its own outcome", () => {
  const diverged = {
    ...input,
    scanned: { ...input.scanned, baseTipPolicyHash: "a".repeat(64) },
  };
  const verdict = evaluatePolicy(diverged);
  // Distinct from stale: a rerun clears stale and can never clear this.
  assert.equal(verdict.outcome, "policy-divergence");
  assert.equal(verdict.exitCode, 1);
  assert.match(verdict.message, /Rebase or merge the target branch/);
  // The accepted exception label is evaluated only after this check.
  assert.equal(evaluatePolicy(input).outcome, "exception");
  assert.equal(
    evaluatePolicy({
      ...diverged,
      current: { ...input.current, labels: [] },
    }).outcome,
    "policy-divergence",
  );
  // A moved head is reported as stale even while the policies also diverge.
  assert.equal(
    evaluatePolicy({
      ...diverged,
      current: { ...input.current, headSha: "a".repeat(40) },
    }).outcome,
    "stale",
  );
  for (const hash of [undefined, "", "A".repeat(64), "a".repeat(63)])
    assert.equal(
      evaluatePolicy({
        ...input,
        scanned: { ...input.scanned, baseTipPolicyHash: hash },
      }).exitCode,
      2,
      String(hash),
    );
});
test("a retarget without a resolved merge base is stale, not evidence failure", () => {
  for (const change of [{ baseRef: "other", baseSha: null }, { baseSha: null }])
    assert.equal(
      evaluatePolicy({ ...input, current: { ...input.current, ...change } })
        .outcome,
      "stale",
      JSON.stringify(change),
    );
  for (const baseSha of ["", "zz", undefined])
    assert.equal(
      evaluatePolicy({ ...input, current: { ...input.current, baseSha } })
        .exitCode,
      2,
      String(baseSha),
    );
  assert.equal(
    evaluatePolicy({ ...input, scanned: { ...input.scanned, baseSha: null } })
      .exitCode,
    2,
  );
});
test("missing rationale fails even with clean scanners", async () =>
  withRepo(async (repo) => {
    const report = await runQuality(runContext(repo));
    const scanned = {
      ...input.scanned,
      headSha: report.policy.configCommit,
      baseSha: report.policy.configCommit,
      configCommit: report.policy.configCommit,
    };
    assert.equal(
      evaluatePolicy({
        ...input,
        report,
        scanned,
        current: { ...input.current, ...scanned, body: "" },
      }).outcome,
      "invalid-exception",
    );
  }));
test("advisory errors and missing or contradictory evidence remain unexemptable", () => {
  assert.equal(evaluatePolicy({ ...input, toolVerified: false }).exitCode, 2);
  for (const change of [
    (r) => r.scanners.pop(),
    (r) => (r.strictExitCode = 0),
    (r) => (r.advisories.testDebt.state = "error"),
    (r) => (r.policy.active.hash = "0".repeat(64)),
    (r) => (r.coverage.blockingFiles = 0),
    (r) => delete r.scanners[0].report.coverage.formats,
    (r) => (r.scanners[0].report.currentClones[0].source = "secret"),
    (r) => (r.scanners[0].report.findings[0].lines = 1),
    (r) => delete r.advisories.testSize,
    (r) => (r.policy.configCommit = "f".repeat(40)),
  ]) {
    const report = structuredClone(input.report);
    change(report);
    assert.equal(evaluatePolicy({ ...input, report }).exitCode, 2);
  }
});

test("all-advisory explicitly has zero blocking coverage", async () =>
  withRepo(async (repo) => {
    const checks = Object.fromEntries(
      ["duplication", "complexity", "fileSize"].map((name) => [
        name,
        { mode: "advisory", reason: "rollout" },
      ]),
    );
    const report = await runQuality(runContext(repo, { checks }));
    const scanned = {
      ...input.scanned,
      headSha: report.policy.configCommit,
      baseSha: report.policy.configCommit,
      configCommit: report.policy.configCommit,
      policyHash: report.policy.active.hash,
      baseTipPolicyHash: report.policy.active.hash,
    };
    const current = { ...input.current, ...scanned };
    assert.equal(
      evaluatePolicy({ ...input, report, scanned, current }).outcome,
      "advisory",
    );
    assert.equal(
      evaluatePolicy({
        ...input,
        report,
        scanned,
        current: { ...current, body: "" },
      }).outcome,
      "invalid-exception",
    );
  }));

test("label and body edits remain current across pushes", () => {
  const next = {
    ...input,
    scanned: { ...input.scanned, headSha: "d".repeat(40) },
    current: { ...input.current, headSha: "d".repeat(40) },
  };
  assert.equal(evaluatePolicy(next).outcome, "exception");
  assert.equal(
    evaluatePolicy({
      ...next,
      current: {
        ...next.current,
        body: "## Quality exception\n<!-- removed -->",
      },
    }).outcome,
    "invalid-exception",
  );
  assert.equal(
    evaluatePolicy({ ...next, current: { ...next.current, labels: [] } })
      .outcome,
    "regression",
  );
});
