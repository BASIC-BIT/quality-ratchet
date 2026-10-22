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
  assert.match(ci, /node: \["24.22.1", "24"\]/);
  assert.match(
    ci,
    /node-version: \$\{\{ matrix\.node \}\}\n\s+check-latest: \$\{\{ matrix\.node == '24' \}\}\n\s+package-manager-cache: false/,
  );
  assert.match(ci, /node-version: "24.22.1"/);
  assert.equal(read(".nvmrc").trim(), "24.22.1");
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

test("schema examples and the adoption template validate", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/validate-examples.mjs"],
    { cwd: toolRoot, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("release validation rejects placeholders, shortened pins and wrong versions", () =>
  withRepo((repo) => {
    for (const path of [
      "quality-ratchet.json",
      "package.json",
      "package-lock.json",
    ])
      cpSync(join(toolRoot, path), join(repo, path));
    const template = readFileSync(
      join(toolRoot, "examples/code-quality.yml"),
      "utf8",
    );
    for (const pin of [
      "REPLACE_WITH_FULL_RELEASE_SHA",
      "ba9c9be # v1.0.0",
      "ba9c9bec7c312a303e61b6779591610cd32509b8 # v2.0.0",
    ]) {
      write(
        repo,
        "examples/code-quality.yml",
        template.replace(
          /quality-ratchet@[a-f0-9]{40} # v\d+\.\d+\.\d+/,
          `quality-ratchet@${pin}`,
        ),
      );
      const result = spawnSync(
        process.execPath,
        [join(toolRoot, "scripts/validate-examples.mjs"), "--release"],
        { cwd: repo, encoding: "utf8" },
      );
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /AssertionError/);
    }

    write(repo, "examples/code-quality.yml", template);
    const ready = spawnSync(
      process.execPath,
      [join(toolRoot, "scripts/validate-examples.mjs"), "--release"],
      { cwd: repo, encoding: "utf8" },
    );
    assert.equal(ready.status, 0, ready.stdout + ready.stderr);
  }));

test("release workflow delegates to a reused CI release validator with real pin checks", () =>
  withRepo((repo) => {
    const ci = readFileSync(join(toolRoot, ".github/workflows/ci.yml"), "utf8");
    const release = readFileSync(
      join(toolRoot, ".github/workflows/release-check.yml"),
      "utf8",
    );
    assert.match(release, /uses: \.\/.github\/workflows\/ci.yml/);
    assert.match(release, /candidate: \$\{\{ inputs.candidate \}\}/);
    const routed = ci.match(
      /- name: Validate release adoption pin\s+if: inputs\.candidate != ''\s+run: (node scripts\/validate-examples\.mjs --release)/,
    );
    assert.ok(
      routed,
      "reusable CI must execute release-mode validation for its candidate route",
    );
    assert.ok(
      ci.indexOf("npm ci --ignore-scripts") < routed.index,
      "reuse the existing locked install",
    );
    const [, script, flag] = routed[1].split(" ");
    for (const path of [
      "quality-ratchet.json",
      "package.json",
      "package-lock.json",
    ])
      cpSync(join(toolRoot, path), join(repo, path));
    const template = readFileSync(
      join(toolRoot, "examples/code-quality.yml"),
      "utf8",
    );
    const validate = () =>
      spawnSync(process.execPath, [join(toolRoot, script), flag], {
        cwd: repo,
        encoding: "utf8",
      });
    write(repo, "examples/code-quality.yml", template);
    const positive = validate();
    assert.equal(positive.status, 0, positive.stdout + positive.stderr);
    write(
      repo,
      "examples/code-quality.yml",
      template.replace(
        /(quality-ratchet@[a-f0-9]{40} # v)\d+\.\d+\.\d+/,
        "$19.9.9",
      ),
    );
    const negative = validate();
    assert.equal(negative.status, 1, negative.stdout + negative.stderr);
    assert.match(
      negative.stderr,
      /Release template version must match package version/,
    );
  }));
