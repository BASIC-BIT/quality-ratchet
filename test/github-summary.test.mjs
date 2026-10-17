import test from "node:test";
import assert from "node:assert/strict";
import { renderSummary } from "../src/github/summary.mjs";
test("failure summary makes missing evidence explicit and escapes exactly once", () => {
  const text = renderSummary({
    report: null,
    scanned: null,
    current: null,
    result: {
      exitCode: 2,
      outcome: "error",
      message: "<img>& *text*",
      rationale: null,
    },
  });
  assert.ok(text.includes("&lt;img&gt;&amp; *text*"));
  assert.ok(!text.includes("&amp;lt;"));
  assert.match(text, /missing/i);
  assert.ok(!text.includes("<img>"));
});

import { withRepo } from "./helpers/repo.mjs";
import { runContext, regressionSources } from "./helpers/process.mjs";
import { runQuality } from "../src/runner.mjs";
test("summary shows metrics and duplicate partners without source snippets", async () =>
  withRepo(async (repo) => {
    regressionSources(repo);
    const report = await runQuality(runContext(repo));
    const text = renderSummary({
      report,
      scanned: null,
      current: null,
      result: {
        outcome: "exception",
        message: "Accepted",
        rationale: "<script> *literal* &",
      },
    });
    assert.match(text, /test\/one.ts/);
    assert.match(text, /test\/two.ts/);
    assert.match(text, /cyclomatic/);
    assert.match(text, /tokens/);
    assert.ok(!text.includes("export function"));
    assert.ok(!text.includes("<script>"));
    assert.ok(text.includes("&lt;script&gt; *literal* &amp;"));
    const bounded = renderSummary({
      report,
      scanned: null,
      current: null,
      result: {
        outcome: "exception",
        message: "Accepted",
        rationale: "a".repeat(100_000),
      },
    });
    assert.ok(bounded.length < 70_000);
    assert.match(bounded, /truncated/);
  }));
