import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { withRepo, write, toolRoot } from "./helpers/repo.mjs";

test("portable test discovery runs tests without executing fixtures or helpers", async () => {
  await withRepo((repo) => {
    cpSync(
      join(toolRoot, "scripts/run-tests.mjs"),
      join(repo, "run-tests.mjs"),
    );
    write(
      repo,
      "test/actual.test.mjs",
      'import test from "node:test"; test("discovered", () => {});',
    );
    for (const path of [
      "test/fixtures/trap.test.mjs",
      "test/helpers/trap.test.mjs",
      "test/helper.mjs",
    ])
      write(repo, path, 'throw new Error("must not execute");');
    const result = spawnSync(process.execPath, ["run-tests.mjs"], {
      cwd: repo,
      env: { ...process.env, NODE_TEST_CONTEXT: undefined },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /discovered/);
    assert.match(result.stdout, /tests 1/);
  });
});

test("release qualification is read-only, covers platforms and keeps action PR-only", () => {
  const read = (path) => readFileSync(join(toolRoot, path), "utf8");
  const ci = read(".github/workflows/ci.yml");
  const release = read(".github/workflows/release-check.yml");

  assert.match(ci, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(ci, /node: \["24.15.0", "24"\]/);
  assert.match(ci, /npm run check/);
  assert.match(ci, /npm ci --ignore-scripts --omit=dev --include=optional/);
  assert.match(ci, /node scripts\/package-smoke.mjs/);
  assert.match(ci, /persist-credentials: false/);
  for (const flow of [ci, release]) {
    assert.doesNotMatch(
      flow,
      /contents: write|pull-requests: write|pull_request_target|secrets: inherit|paths-ignore:|paths:/,
    );
    for (const use of flow.matchAll(/uses: (actions\/[^\s]+)/g))
      assert.match(use[1], /@[a-f0-9]{40}$/);
  }
  assert.match(ci, /branches: \[main\]/);
  assert.match(ci, /if: github.event_name == 'pull_request'/);
  assert.match(ci, /uses: \.\//);
  assert.match(ci, /github.event.pull_request.head.sha \|\| github.sha/);
  assert.match(release, /candidate: \$\{\{ inputs.candidate \}\}/);
  assert.match(release, /uses: \.\/.github\/workflows\/ci.yml/);
  assert.match(
    ci,
    /ref: \$\{\{ inputs.candidate \|\| github.event.pull_request.head.sha \|\| github.sha \}\}/,
  );
  assert.match(ci, /name: Checkout candidate action source/);
  assert.doesNotMatch(release, /git push|gh release/);
  const scripts = JSON.parse(read("package.json")).scripts;
  assert.equal(scripts.test, "node scripts/run-tests.mjs");
  for (const command of [
    "npm test",
    "npm run lint",
    "npm run format:check",
    "npm run validate:examples",
  ])
    assert.ok(scripts.check.includes(command));
});

test("schema examples validate and unpublished template fails final release validation", () => {
  const run = (...args) =>
    spawnSync(process.execPath, ["scripts/validate-examples.mjs", ...args], {
      cwd: toolRoot,
      encoding: "utf8",
    });
  assert.equal(run().status, 0);
  assert.equal(run("--release").status, 1);
});
