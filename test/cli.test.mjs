import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { withRepo, write, commit, toolRoot } from "./helpers/repo.mjs";
const cli = (repo, args) =>
  spawnSync(
    process.execPath,
    [
      join(toolRoot, "bin/quality-ratchet.mjs"),
      ...args,
      "--repo",
      repo,
      "--json",
    ],
    { encoding: "utf8", windowsHide: true },
  );

const runtimeCommands = [
  ["--version"],
  ["tool-manifest"],
  [],
  ["check", "--base", "HEAD"],
  ["report-test-debt"],
  ["report-test-size"],
  ["explain-config", "--base", "HEAD"],
];
const runtimeCli = (repo, args, version) =>
  spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(`Object.defineProperty(process.versions, "node", { value: ${JSON.stringify(version)} });`)}`,
      join(toolRoot, "bin/quality-ratchet.mjs"),
      ...args,
    ],
    { cwd: repo, encoding: "utf8", windowsHide: true },
  );

test("all local entry routes reject unsupported runtimes before tool or repository work", async () =>
  withRepo((repo) => {
    for (const version of ["24.21.0", "24.22.0", "23.22.1", "25.0.0"])
      for (const args of runtimeCommands) {
        const plain = runtimeCli(repo, args, version);
        assert.equal(plain.status, 2, plain.stdout + plain.stderr);
        assert.match(plain.stdout, /Unsupported tool runtime/);
        const json = runtimeCli(repo, [...args, "--json"], version);
        assert.equal(json.status, 2, json.stdout + json.stderr);
        assert.deepEqual(JSON.parse(json.stdout), {
          schemaVersion: 1,
          error: "Unsupported tool runtime; use Node >=24.22.1 <25",
          strictExitCode: 2,
        });
      }
  }));

test("all local entry routes accept the floor and later Node 24 versions", async () =>
  withRepo((repo) => {
    for (const version of ["24.22.1", "24.23.0"])
      for (const args of runtimeCommands) {
        const options = args[0] === "--version" ? args : [...args, "--json"];
        if (args.length === 0) options.unshift("--base", "HEAD");
        const result = runtimeCli(repo, options, version);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.ok(result.stdout.trim());
      }
  }));

test("local commands reject policy flags and explain the missing default base", async () =>
  withRepo((repo) => {
    for (const args of [
      ["--warn-only"],
      ["--max-lines", "20"],
      ["report-test-size", "--base", "HEAD"],
    ])
      assert.equal(cli(repo, args).status, 2);
    const missing = cli(repo, []);
    assert.equal(missing.status, 2);
    assert.match(missing.stdout, /--base/);
    assert.equal(cli(repo, ["--base", "HEAD"]).status, 0);
  }));

test("absolute size warns without gating, and disabled diagnostics are explicit", async () =>
  withRepo((repo) => {
    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({
        schemaVersion: 1,
        reports: { testDebt: false, testSize: { oversizedLines: 2 } },
      }),
    );
    commit(repo);
    write(repo, "test/large.ts", "// one\n// two\n");
    const size = cli(repo, ["report-test-size"]);
    assert.equal(size.status, 0, size.stdout + size.stderr);
    assert.equal(JSON.parse(size.stdout).report.data.oversizedFiles.length, 1);
    const debt = cli(repo, ["report-test-debt"]);
    assert.equal(debt.status, 0);
    assert.equal(JSON.parse(debt.stdout).report.state, "disabled");
  }));

test("explain-config shows baseline enforcement and proposed changes", async () =>
  withRepo((repo) => {
    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({
        schemaVersion: 1,
        checks: { fileSize: { maxLines: 20 } },
      }),
    );
    const result = cli(repo, ["explain-config", "--base", "HEAD"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.policy.active.checks.fileSize.maxLines, 1000);
    assert.equal(report.policy.proposed.checks.fileSize.maxLines, 20);
    assert.equal(report.policy.changed, true);
  }));

test("diagnostics use committed HEAD policy when proposed settings differ, without origin/HEAD", async () =>
  withRepo((repo) => {
    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({
        schemaVersion: 1,
        reports: { testSize: { enabled: false } },
      }),
    );
    const result = cli(repo, ["report-test-size"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.policy.active.reports.testSize.enabled, true);
    assert.equal(report.policy.proposed.reports.testSize.enabled, false);
    assert.equal(report.report.state, "reported");
  }));

test("invalid proposed configuration and all-off policies fail operationally", async () =>
  withRepo((repo) => {
    write(repo, "quality-ratchet.json", "{not valid}");
    assert.equal(cli(repo, ["report-test-size"]).status, 2);
    const off = { mode: "off", reason: "disabled" };
    write(
      repo,
      "quality-ratchet.json",
      JSON.stringify({
        schemaVersion: 1,
        checks: { duplication: off, complexity: off, fileSize: off },
      }),
    );
    assert.equal(cli(repo, ["--base", "HEAD"]).status, 2);
  }));
