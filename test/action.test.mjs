import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  openSync,
  closeSync,
  statSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  cpSync,
  existsSync,
  rmSync,
  readdirSync,
  realpathSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  withInstalledTool,
  repositoryPath,
} from "../scripts/bootstrap-tool.mjs";
import {
  assetFiles,
  toolManifest,
  verifyInstalledTool,
} from "../src/tool-manifest.mjs";
import { git, commit, write, toolRoot, withRepo } from "./helpers/repo.mjs";

import { runContext } from "./helpers/process.mjs";
import { runQuality } from "../src/runner.mjs";
import { validatePolicyReport } from "../src/report.mjs";
import { summarizeTestSources } from "../src/reports/test-size.mjs";

const read = (name) => readFileSync(join(toolRoot, name), "utf8");
const execute = (file, args = [], options = {}) =>
  spawnSync(process.execPath, [file, ...args], {
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });

test("action exposes only supported inputs and publishes before saved failure", () => {
  const action = read("action.yml");
  assert.match(action, /inputs:\n  github-token:/);
  assert.deepEqual(
    [
      ...action
        .slice(action.indexOf("inputs:"), action.indexOf("outputs:"))
        .matchAll(/^  ([\w-]+):/gm),
    ].map((m) => m[1]),
    ["github-token", "repository-path"],
  );
  assert.match(action, /default: \$\{\{ github.workspace \}\}/);
  for (const output of ["outcome", "strict-exit-code", "report-directory"])
    assert.ok(action.includes(`  ${output}:`));
  assert.match(
    action,
    /actions\/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1/,
  );
  assert.match(action, /node-version: "24.15.0"/);
  assert.match(action, /package-manager-cache: false/);
  assert.match(
    action,
    /actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/,
  );
  assert.match(action, /retention-days: 7/);
  assert.match(action, /if: \$\{\{ !cancelled\(\)/);
  assert.ok(
    action.indexOf("bootstrap-tool.mjs") <
      action.indexOf("actions/upload-artifact"),
  );
  assert.ok(
    action.indexOf("actions/upload-artifact") <
      action.indexOf("finish-action.mjs"),
  );
  assert.doesNotMatch(
    action,
    /continue-on-error|secrets: inherit|pull_request_target/,
  );
});

test("consumer template has seven read-only events and exact-head checkout", () => {
  const flow = read("examples/code-quality.yml");
  for (const event of [
    "opened",
    "synchronize",
    "reopened",
    "ready_for_review",
    "edited",
    "labeled",
    "unlabeled",
  ])
    assert.ok(flow.includes(event));
  assert.match(flow, /contents: read\n  pull-requests: read/);
  assert.match(flow, /cancel-in-progress: true/);
  assert.match(flow, /github.event.pull_request.number/);
  assert.match(flow, /name: Code quality ratchet/);
  assert.match(flow, /timeout-minutes: 20/);
  assert.match(
    flow,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/,
  );
  assert.match(flow, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(flow, /fetch-depth: 0/);
  assert.match(flow, /persist-credentials: false/);
  assert.match(
    flow,
    new RegExp(
      `BASIC-BIT/quality-ratchet@[a-f0-9]{40} # v${JSON.parse(read("package.json")).version.replaceAll(".", "\\.")}(?=\\s|$)`,
    ),
  );
  assert.match(flow, /github-token: \$\{\{ github.token \}\}/);
  assert.doesNotMatch(
    flow,
    /paths:|paths-ignore:|pull_request_target|secrets: inherit|continue-on-error/,
  );
  assert.deepEqual(
    [
      ...flow
        .slice(flow.indexOf("BASIC-BIT/quality-ratchet"))
        .matchAll(/^          ([\w-]+):/gm),
    ].map((m) => m[1]),
    ["github-token", "repository-path"],
  );
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "quality action with spaces "));
  const workspace = join(root, "workspace"),
    consumer = join(workspace, "consumer with spaces"),
    temp = join(root, "runner temp"),
    source = join(root, "action source");
  mkdirSync(consumer, { recursive: true });
  mkdirSync(temp);
  cpSync(join(toolRoot, "test/fixtures/hostile-consumer"), consumer, {
    recursive: true,
  });
  git(consumer, "init", "-q");
  write(consumer, "src/real.ts", "export const value = 42;\n");
  commit(consumer);
  for (const name of ["eslint", "typescript"])
    write(
      consumer,
      `node_modules/${name}/package.json`,
      JSON.stringify({ name, version: "0.0.0" }),
    );
  for (const name of [
    "src",
    "scripts",
    "bin",
    "schema",
    "package.json",
    "package-lock.json",
    ".nvmrc",
    "LICENSE",
    "NOTICE",
  ])
    cpSync(join(toolRoot, name), join(source, name), { recursive: true });
  return { root, workspace, consumer, temp, source };
}
function identity(repo) {
  return [
    git(repo, "status", "--porcelain=v1", "--untracked-files=all"),
    readFileSync(join(repo, ".git/index")).toString("hex"),
    readFileSync(join(repo, ".git/config"), "utf8"),
    readFileSync(join(repo, ".npmrc"), "utf8"),
    readFileSync(join(repo, "package.json"), "utf8"),
    assetFiles(
      repo,
      readdirSync(repo).filter((name) => name !== ".git"),
    ).map((path) => [path, readFileSync(join(repo, path)).toString("hex")]),
  ];
}

test(
  "real locked installation excludes hostile npm settings and consumer dependencies",
  { timeout: 240000 },
  async () => {
    const f = fixture(),
      before = identity(f.consumer);
    const hostile = {
      npm_config_registry: "http://127.0.0.1:9",
      NPM_CONFIG_USERCONFIG: join(f.consumer, ".npmrc"),
      npm_config_prefix: f.consumer,
      npm_config_ignore_scripts: "false",
      npm_config_omit: "optional",
      NODE_OPTIONS: `--require "${join(f.consumer, "lifecycle.cjs").replaceAll("\\", "/")}"`,
      NODE_PATH: join(f.consumer, "node_modules"),
      TMPDIR: f.consumer,
      TMP: f.consumer,
      TEMP: f.consumer,
    };
    const previous = Object.fromEntries(
      Object.keys(hostile).map((key) => [key, process.env[key]]),
    );
    Object.assign(process.env, hostile);
    try {
      assert.equal(
        repositoryPath(f.workspace, f.consumer),
        realpathSync.native(f.consumer),
      );
      assert.throws(() => repositoryPath(f.workspace, f.source));
      assert.throws(() => repositoryPath(f.workspace, f.workspace));
      await withInstalledTool(
        { actionPath: f.source, tempRoot: f.temp },
        async ({ root, expected, env }) => {
          const manifest = await verifyInstalledTool(root, expected);
          assert.equal(manifest.scanners.eslint, "10.12.0");
          assert.equal(manifest.scanners.typescript, "6.0.3");
          assert.ok(manifest.assetHash && manifest.lockHash);
          assert.ok(env.TMPDIR.startsWith(f.temp));
          assert.equal(env.TMP, env.TMPDIR);
          assert.equal(env.TEMP, env.TMPDIR);
          const result = execute(
            join(root, "bin/quality-ratchet.mjs"),
            ["check", "--base", "HEAD", "--repo", f.consumer, "--json"],
            { cwd: f.consumer, env },
          );
          assert.equal(result.status, 0, result.stdout + result.stderr);
          assert.equal(JSON.parse(result.stdout).coverage.enabledFiles, 3);
          assert.ok(!existsSync(join(root, "node_modules/prettier")));
          const dependency = join(root, "node_modules/eslint/package.json");
          const original = readFileSync(dependency);
          writeFileSync(dependency, JSON.stringify({ version: "0.0.0" }));
          await assert.rejects(verifyInstalledTool(root, expected));
          writeFileSync(dependency, original);
          writeFileSync(join(root, "src/contracts.mjs"), "// tampered\n");
          await assert.rejects(verifyInstalledTool(root, expected));
        },
      );
      assert.deepEqual(readdirSync(f.temp), []);
      assert.deepEqual(identity(f.consumer), before);
      assert.ok(!existsSync(join(f.consumer, "LIFECYCLE_RAN")));
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(f.root, { recursive: true, force: true });
    }
  },
);

test(
  "installed failing action saves upload evidence and cleanup precedes finish",
  { timeout: 240000 },
  async () => {
    const f = fixture(),
      before = identity(f.consumer);
    try {
      await assert.rejects(
        withInstalledTool(
          { actionPath: f.source, tempRoot: f.temp },
          async ({ root, expected }) => {
            const reports = join(f.root, "reports"),
              event = join(f.root, "event.json"),
              output = join(f.root, "outputs"),
              summary = join(f.root, "summary");
            writeFileSync(event, JSON.stringify({ action: "opened" }));
            const result = execute(join(root, "scripts/run-action.mjs"), [], {
              cwd: f.consumer,
              env: {
                ...process.env,
                QR_EXPECTED_MANIFEST: JSON.stringify(expected),
                QR_REPOSITORY_PATH: f.consumer,
                QR_REPORT_DIRECTORY: reports,
                QR_TEMP_ROOT: f.temp,
                GITHUB_EVENT_PATH: event,
                GITHUB_EVENT_NAME: "pull_request",
                GITHUB_OUTPUT: output,
                GITHUB_STEP_SUMMARY: summary,
              },
            });
            assert.equal(result.status, 0, result.stderr);
            const evidence = JSON.parse(
              readFileSync(join(reports, "quality-evidence.json")),
            );
            assert.equal(evidence.result.outcome, "error");
            assert.equal(evidence.tool.verified, true);
            assert.ok(evidence.tool.assetHash);
            assert.match(readFileSync(output, "utf8"), /outcome/);
            assert.ok(existsSync(summary));
            assert.equal(
              execute(join(f.source, "scripts/finish-action.mjs"), [], {
                env: { ...process.env, QR_REPORT_DIRECTORY: reports },
              }).status,
              2,
            );
            evidence.result = {
              ...evidence.result,
              outcome: "clean",
              exitCode: 0,
            };
            writeFileSync(
              join(reports, "quality-evidence.json"),
              JSON.stringify(evidence),
            );
            assert.equal(
              execute(join(f.source, "scripts/finish-action.mjs"), [], {
                env: { ...process.env, QR_REPORT_DIRECTORY: reports },
              }).status,
              0,
            );
            throw new Error("callback failure");
          },
        ),
        /callback failure/,
      );
      assert.deepEqual(readdirSync(f.temp), []);
      assert.deepEqual(identity(f.consumer), before);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  },
);

test("manifest command is inspection-only and preserves strict command parsing", () => {
  const result = execute(join(toolRoot, "bin/quality-ratchet.mjs"), [
    "tool-manifest",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(result.stdout).version,
    toolManifest(toolRoot).version,
  );
  assert.equal(
    execute(join(toolRoot, "bin/quality-ratchet.mjs"), ["--version"]).status,
    0,
  );
  assert.equal(
    execute(join(toolRoot, "bin/quality-ratchet.mjs"), [
      "tool-manifest",
      "--repo",
      toolRoot,
    ]).status,
    2,
  );
});

test("real bootstrap failures retain outputs without consumer writes or leftover tool files", () => {
  const f = fixture(),
    before = identity(f.consumer);
  try {
    const output = join(f.root, "bootstrap-output"),
      summary = join(f.root, "bootstrap-summary");
    const run = execute(join(f.source, "scripts/bootstrap-tool.mjs"), [], {
      cwd: f.consumer,
      env: {
        ...process.env,
        RUNNER_TEMP: f.temp,
        GITHUB_WORKSPACE: f.workspace,
        QR_REPOSITORY_PATH: f.source,
        QR_ACTION_PATH: f.source,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(readFileSync(output, "utf8"), /report-directory/);
    const entries = readdirSync(f.temp);
    assert.equal(entries.length, 1);
    assert.ok(entries[0].startsWith("quality-reports-"));
    assert.equal(
      JSON.parse(
        readFileSync(join(f.temp, entries[0], "quality-evidence.json")),
      ).result.exitCode,
      2,
    );
    assert.deepEqual(identity(f.consumer), before);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test(
  "full bootstrap process installs and cleans up before exposing an unsupported-event verdict",
  { timeout: 240000 },
  () => {
    const f = fixture(),
      before = identity(f.consumer);
    try {
      const output = join(f.root, "output"),
        event = join(f.root, "event.json");
      writeFileSync(event, JSON.stringify({ action: "deleted" }));
      const run = execute(join(f.source, "scripts/bootstrap-tool.mjs"), [], {
        cwd: f.consumer,
        env: {
          ...process.env,
          RUNNER_TEMP: f.temp,
          GITHUB_WORKSPACE: f.workspace,
          QR_REPOSITORY_PATH: f.consumer,
          QR_ACTION_PATH: f.source,
          GITHUB_OUTPUT: output,
          GITHUB_EVENT_PATH: event,
          GITHUB_EVENT_NAME: "pull_request",
          npm_config_registry: "http://127.0.0.1:9",
        },
      });
      assert.equal(run.status, 0, run.stderr);
      const entries = readdirSync(f.temp);
      assert.equal(entries.length, 1);
      const report = join(f.temp, entries[0]);
      assert.match(
        JSON.parse(readFileSync(join(report, "quality-evidence.json"))).result
          .message,
        /Unsupported event/,
      );
      const outputs = readFileSync(output, "utf8");
      for (const name of ["report-directory", "outcome", "strict-exit-code"])
        assert.ok(outputs.includes(name));
      assert.equal(
        execute(join(f.source, "scripts/finish-action.mjs"), [], {
          env: { ...process.env, QR_REPORT_DIRECTORY: report },
        }).status,
        2,
      );
      assert.deepEqual(identity(f.consumer), before);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  },
);

test("action canonicalizes repository aliases while rejecting external symlink targets", () => {
  const f = fixture();
  try {
    const alias = join(f.workspace, "consumer alias");
    symlinkSync(f.consumer, alias, "junction");
    assert.equal(
      repositoryPath(f.workspace, alias),
      realpathSync.native(f.consumer),
    );
    const requested =
      process.platform === "win32" ? f.consumer.toLowerCase() : f.consumer;
    assert.equal(
      repositoryPath(f.workspace, requested),
      realpathSync.native(f.consumer),
    );
    git(f.source, "init", "-q");
    const outside = join(f.workspace, "outside alias");
    symlinkSync(f.source, outside, "junction");
    assert.throws(
      () => repositoryPath(f.workspace, outside),
      /inside the workspace/,
    );
    assert.throws(() => repositoryPath(f.workspace, join(f.consumer, "src")));
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

async function warningReport(callback, reports = {}) {
  return withRepo(async (repo) => {
    write(
      repo,
      "test/large.ts",
      'const privateSource = "NEVER_PUBLISH_SOURCE";\n\n\n',
    );
    commit(repo);
    const report = await runQuality(
      runContext(repo, {
        reports: {
          testDebt: false,
          testSize: { oversizedLines: 3 },
          ...reports,
        },
      }),
    );
    return callback(report);
  });
}
function published(f, report) {
  const directory = join(f.root, "publication");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "summary.md"), "saved summary\n");
  const saved = { report, result: { outcome: "clean", exitCode: 0 } };
  const input = join(directory, "input.json");
  writeFileSync(input, JSON.stringify(saved));
  const script = `import { publishWarnings } from ${JSON.stringify(new URL("../scripts/run-action.mjs", import.meta.url).href)};
    import { readFileSync } from "node:fs";
    await publishWarnings(JSON.parse(readFileSync(process.argv[1])).report);`;
  return execute("--input-type=module", ["-e", script, input, directory]);
}
test("publication warns for unchanged oversized tests without changing the clean verdict", async () => {
  const f = fixture();
  try {
    await warningReport((report) => {
      assert.equal(report.strictExitCode, 0);
      const before = JSON.stringify(report);
      const run = published(f, report);
      assert.equal(run.status, 0, run.stderr);
      assert.match(
        run.stdout,
        /^::warning file=test\/large.ts,line=1::.*3.*3/m,
      );
      assert.doesNotMatch(run.stdout, /NEVER_PUBLISH_SOURCE/);
      assert.equal(JSON.stringify(report), before);
    });
    for (const reports of [
      { testSize: { enabled: false } },
      { testSize: { oversizedLines: 1000 } },
    ])
      await warningReport((report) => {
        const run = published(f, report);
        assert.equal(run.status, 0, run.stderr);
        assert.equal(run.stdout, "");
      }, reports);
    await warningReport((report) => {
      report.advisories.testSize = {
        ...report.advisories.testSize,
        state: "error",
        data: null,
        error: "Enabled diagnostic report failed",
      };
      report.strictExitCode = 2;
      for (const failed of [null, report]) {
        const run = published(f, failed);
        assert.equal(run.status, 0, run.stderr);
        assert.equal(run.stdout, "");
      }
    });
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test("warning properties escape command delimiters and controls and reject invalid inventory", async () => {
  const f = fixture();
  try {
    await warningReport((report) => {
      const inventory = report.advisories.testSize.data;
      inventory.entries[0].path = "test/a%,:\r\n::error::injected\t\u001b.ts";
      report.advisories.testSize.data = summarizeTestSources(
        inventory.entries,
        3,
      );
      const run = published(f, report);
      assert.equal(run.status, 0, run.stderr);
      assert.match(
        run.stdout,
        /^::warning file=test\/a%25%2C%3A%0D%0A%3A%3Aerror%3A%3Ainjected%09%1B.ts,line=1::/,
      );
      assert.equal(run.stdout.trimEnd().split("\n").length, 1);
      report.advisories.testSize.data.oversizedFiles[0].lines++;
      const invalid = published(f, report);
      assert.notEqual(invalid.status, 0);
      assert.equal(invalid.stdout, "");
    });
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
for (const warningCount of [1, 23000])
  test(
    `full bootstrap publishes ${warningCount} validated warnings once without buffering child warnings`,
    { timeout: 240000 },
    async () => {
      const f = fixture(),
        before = identity(f.consumer);
      try {
        await warningReport((report) => {
          if (warningCount > 1) {
            const entries = Array.from({ length: warningCount }, (_, i) => ({
              path: `test/oversized,%warning-${i}-${"x".repeat(110)}.ts`,
              lines: 3,
            }));
            report.advisories.testSize.data = summarizeTestSources(entries, 3);
            report.coverage.enabledFiles = report.coverage.blockingFiles =
              warningCount + 1;
            for (const scan of report.scanners) {
              report.coverage.gates[scan.name] = warningCount + 1;
              scan.report.coverage.eligibleFiles =
                scan.report.coverage.baselineFiles = warningCount + 1;
            }
          }
          validatePolicyReport(report);
          writeFileSync(
            join(f.source, "src/github/cli.mjs"),
            `
        import { writeEvidence } from "./evidence.mjs";
        import { renderSummary } from "./summary.mjs";
        import { writeFileSync } from "node:fs";
        import { join } from "node:path";
        export async function runHosted({directory}) {
          console.log("::error::UNTRUSTED_CHILD_OUTPUT");
          console.error("::error::PRIVATE_CHILD_STDERR");
          const saved = {report:${JSON.stringify(report)}, scanned:null, current:null, tool:null,
            result:{exitCode:0,outcome:"clean",rationale:null,message:"Clean"}};
          writeEvidence({...saved,directory});
          writeFileSync(join(directory,"summary.md"),renderSummary(saved));
          return saved;
        }
      `,
          );
          const event = join(f.root, "event.json");
          writeFileSync(event, JSON.stringify({ action: "opened" }));
          const stdoutPath = join(f.root, "runner-stdout");
          const stdoutFd = openSync(stdoutPath, "w");
          let run;
          try {
            run = execute(join(f.source, "scripts/bootstrap-tool.mjs"), [], {
              stdio: ["pipe", stdoutFd, "pipe"],
              env: {
                ...process.env,
                RUNNER_TEMP: f.temp,
                GITHUB_WORKSPACE: f.workspace,
                QR_REPOSITORY_PATH: f.consumer,
                QR_ACTION_PATH: f.source,
                GITHUB_EVENT_PATH: event,
                GITHUB_EVENT_NAME: "pull_request",
                GITHUB_OUTPUT: join(f.root, "outputs"),
                GITHUB_STEP_SUMMARY: join(f.root, "summary"),
              },
            });
          } finally {
            closeSync(stdoutFd);
          }
          assert.equal(run.status, 0, run.stderr);
          const warningOutput = readFileSync(stdoutPath, "utf8");
          assert.doesNotMatch(
            warningOutput + run.stderr,
            /UNTRUSTED_CHILD_OUTPUT|PRIVATE_CHILD_STDERR|NEVER_PUBLISH_SOURCE/,
          );
          const entries = readdirSync(f.temp);
          assert.equal(entries.length, 1);
          const directory = join(f.temp, entries[0]);
          const saved = JSON.parse(
            readFileSync(join(directory, "quality-results.json")),
          );
          assert.match(
            readFileSync(join(f.root, "summary"), "utf8"),
            /oversizedFiles/,
          );
          assert.equal(saved.result.exitCode, 0);
          assert.equal(saved.quality.strictExitCode, 0);
          assert.equal(
            warningOutput.trimEnd().split("\n").length,
            warningCount,
          );
          assert.match(warningOutput, /^::warning file=test\//);
          if (warningCount > 1)
            assert.ok(statSync(stdoutPath).size > 4 * 1024 * 1024);
          assert.equal(
            saved.quality.advisories.testSize.data.oversizedFiles.length,
            warningCount,
          );
          assert.equal(
            execute(join(f.source, "scripts/finish-action.mjs"), [], {
              env: { ...process.env, QR_REPORT_DIRECTORY: directory },
            }).status,
            0,
          );
          assert.deepEqual(identity(f.consumer), before);
        });
      } finally {
        rmSync(f.root, { recursive: true, force: true });
      }
    },
  );
