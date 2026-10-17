import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  scanDuplication,
  runJscpd,
  validateNativeReport,
} from "../src/duplication/scanner.mjs";
import { encodeScanContext } from "../src/contracts.mjs";
import { resolveComparison } from "../src/git/comparison.mjs";
import { resolvePolicy } from "../src/config/resolve.mjs";
import { fingerprintCloneSource } from "../src/duplication/normalize.mjs";
import { withRepo, write, commit, git } from "./helpers/repo.mjs";
import { scan, body, toolRoot } from "./helpers/duplication.mjs";

test("scanner transport emits one sanitized measured report, including advisory findings", async () =>
  withRepo(async (repo) => {
    write(repo, "a.js", body("alpha"));
    commit(repo);
    write(repo, "b.js", body("beta"));
    const context = {
      comparison: resolveComparison({ repo, base: "HEAD" }),
      policy: resolvePolicy({
        schemaVersion: 1,
        checks: {
          duplication: { mode: "advisory", reason: "Measure rollout" },
        },
      }),
      toolRoot,
    };
    const result = spawnSync(
      process.execPath,
      [join(toolRoot, "src/scanners/duplication.mjs")],
      { input: encodeScanContext(context), encoding: "utf8", cwd: repo },
    );
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.policyHash, context.policy.hash);
    assert.equal(report.findings[0].mode, "advisory");
    assert.ok(report.currentClones.length);
    assert.doesNotMatch(result.stdout, /const trimmed|normalized|fragment/);
    assert.ok(
      report.currentClones.every(
        (row) => Object.getOwnPropertySymbols(row).length === 0,
      ),
    );
    const invalid = spawnSync(
      process.execPath,
      [join(toolRoot, "src/scanners/duplication.mjs")],
      { input: "{}", encoding: "utf8" },
    );
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, "");
  }));

test("native scanner ignores consumer configuration and has explicit policy minimum lines", async () =>
  withRepo(async (repo) => {
    write(repo, "original.js", body("alpha"));
    commit(repo);
    write(repo, "copy.js", body("beta"));
    write(
      repo,
      ".jscpd.json",
      JSON.stringify({
        minTokens: 999999,
        minLines: 99999,
        ignore: ["**/*"],
        reporters: [],
        ignorePattern: [".*"],
      }),
    );
    write(
      repo,
      "package.json",
      JSON.stringify({
        jscpd: { minTokens: 999999 },
        scripts: { preinstall: "exit 99" },
      }),
    );
    const report = await scan(repo);
    assert.ok(report.findings.length);
    assert.equal(report.coverage.mode, "ratchet");
    const short = mkdtempSync(join(tmpdir(), "quality-short-"));
    try {
      for (const file of ["a.js", "b.js"])
        write(
          short,
          file,
          Array.from(
            { length: 7 },
            (_, i) =>
              `const result${i} = compute(input${i}, source${i}, options${i}, fallback${i});`,
          ).join("\n"),
        );
      assert.equal(
        (await runJscpd(short, { minLines: 8, minTokens: 50 })).length,
        0,
      );
      assert.ok((await runJscpd(short, { minLines: 5, minTokens: 50 })).length);
    } finally {
      rmSync(short, { recursive: true, force: true });
    }
  }));

test("malformed, missing, terminated and unsafe scanner reports fail operationally", async () =>
  withRepo(async (repo) => {
    write(repo, "a.js", body("alpha"));
    commit(repo);
    const harness = mkdtempSync(join(tmpdir(), "quality-fake-tool-"));
    try {
      mkdirSync(join(harness, "node_modules/jscpd"), { recursive: true });
      const cli = join(harness, "node_modules/jscpd/run-jscpd.js");
      for (const code of [
        "",
        "require('fs').writeFileSync(require('path').join(process.argv[process.argv.indexOf('-o')+1],'jscpd-report.json'),'{}')",
        "process.kill(process.pid,'SIGTERM')",
      ]) {
        writeFileSync(cli, code);
        await assert.rejects(
          runJscpd(repo, { toolRoot: harness, minLines: 8, minTokens: 50 }),
        );
      }
      assert.throws(() =>
        validateNativeReport(
          {
            statistics: {
              total: { sources: 2, tokens: 120, lines: 18, clones: 1 },
            },
            duplicates: [
              {
                format: "javascript",
                lines: 9,
                tokens: 60,
                firstFile: { name: "../outside.js", start: 1, end: 9 },
                secondFile: { name: "a.js", start: 1, end: 9 },
              },
            ],
          },
          repo,
        ),
      );
    } finally {
      rmSync(harness, { recursive: true, force: true });
    }
  }));

for (const mode of ["tracked ignored source", "source above one MiB"])
  test(mode + " retains coverage without consumer mutations", async () =>
    withRepo(async (repo) => {
      if (mode === "tracked ignored source") {
        write(repo, ".gitignore", "original.js\n");
        write(repo, "original.js", body("alpha"));
        git(repo, "add", "-f", "original.js");
      } else write(repo, "original.js", body("alpha"));
      commit(repo);
      write(
        repo,
        "copy.js",
        (mode === "source above one MiB"
          ? "/*" + "x".repeat(1024 * 1024) + "*/\n"
          : "") + body("beta"),
      );
      const status = git(repo, "status", "--porcelain=v1", "-z");
      const index = readFileSync(join(repo, ".git/index"));
      const config = readFileSync(join(repo, ".git/config"));
      const report = await scan(repo);
      assert.ok(report.findings.length);
      assert.equal(git(repo, "status", "--porcelain=v1", "-z"), status);
      assert.deepEqual(readFileSync(join(repo, ".git/index")), index);
      assert.deepEqual(readFileSync(join(repo, ".git/config")), config);
    }),
  );

test("ignored scratch and excluded paths do not produce findings", async () =>
  withRepo(async (repo) => {
    write(repo, ".gitignore", "tmp/\n");
    commit(repo);
    write(repo, "a.js", body("alpha"));
    write(repo, "tmp/scratch.js", body("beta"));
    assert.equal((await scan(repo)).findings.length, 0);
    write(repo, "excluded/b.js", body("beta"));
    assert.equal(
      (
        await scan(repo, "HEAD", {
          checks: { duplication: { exclude: ["excluded/**"] } },
        })
      ).findings.length,
      0,
    );
  }));

test("unchanged trees still return current clone inventory for diagnostics", async () =>
  withRepo(async (repo) => {
    write(repo, "a.js", body("alpha"));
    write(repo, "b.js", body("beta"));
    commit(repo);
    const report = await scan(repo);
    assert.equal(report.changedFiles, 0);
    assert.deepEqual(report.findings, []);
    assert.ok(report.scanned > 0);
    assert.ok(report.currentClones.length > 0);
  }));

test("all eight JS/TS extensions and test fixture copies participate", async () => {
  for (const ext of ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"])
    await withRepo(async (repo) => {
      write(repo, `test/a.${ext}`, body("alpha"));
      commit(repo);
      write(repo, `test/fixtures/b.${ext}`, body("beta"));
      assert.ok((await scan(repo)).findings.length, ext);
    });
});
test("promoting generated code to eligible source is checked", async () =>
  withRepo(async (repo) => {
    write(repo, "a.js", body("alpha"));
    write(repo, "generated/b.js", body("beta"));
    commit(repo);
    git(repo, "mv", "generated/b.js", "b.js");
    assert.ok((await scan(repo)).findings.length);
  }));
test("unsupported tokenizer grammars cannot collapse to an empty identity", () => {
  for (const format of ["razor", "excel-formula"])
    assert.notEqual(
      fingerprintCloneSource("old", format),
      fingerprintCloneSource("new", format),
    );
});

import { hasNativeSuppression } from "../src/duplication/suppression.mjs";
test("native suppression markers cannot hide a duplicate, including quoted comment-shaped markers", async () => {
  const begin = "jscpd:" + "ignore-start",
    end = "jscpd:" + "ignore-end";
  for (const [left, right] of [
    [`// ${begin}`, `// ${end}`],
    [`const left="/* ${begin} */";`, `const right="/* ${end} */";`],
  ])
    await withRepo(async (repo) => {
      write(repo, "a.js", body("alpha"));
      commit(repo);
      write(repo, "b.js", left + "\n" + body("beta") + right + "\n");
      assert.equal(
        (await runJscpd(repo, { minLines: 8, minTokens: 50 })).length,
        0,
      );
      await assert.rejects(scan(repo), /Unsupported native suppression.*b.js/);
    });
  assert.equal(
    hasNativeSuppression(`// ${begin}\nlet x=1;`, "javascript"),
    false,
  );
  assert.equal(
    hasNativeSuppression(`// ${end}\nlet x=1;`, "javascript"),
    false,
  );
  assert.equal(
    hasNativeSuppression(
      `const x="${begin}";\nconst y="${end}";`,
      "javascript",
    ),
    false,
  );
  assert.equal(hasNativeSuppression(`# ${begin}\nx=1`, "python"), true);
  assert.equal(hasNativeSuppression(`value="${end}"`, "python"), true);
  assert.equal(
    hasNativeSuppression(`<!-- ${begin} -->\nprose`, "markdown"),
    false,
  );
  assert.equal(
    hasNativeSuppression(
      `<!-- ${begin} -->\nprose\n<!-- ${end} -->`,
      "markdown",
    ),
    true,
  );
});
