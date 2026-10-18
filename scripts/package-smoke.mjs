import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { withInstalledTool } from "./bootstrap-tool.mjs";
import { verifyInstalledTool } from "../src/tool-manifest.mjs";
import { git } from "../src/git/commands.mjs";

const actionPath = dirname(dirname(fileURLToPath(import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), "quality-package-smoke-"));
const started = performance.now();
try {
  const repo = join(scratch, "consumer"),
    reports = join(scratch, "reports");
  mkdirSync(repo);
  git(repo, ["init", "-q"]);
  writeFileSync(join(repo, "base.ts"), "export const original = 1;\n");
  writeFileSync(
    join(repo, "large.test.ts"),
    "// existing test source\n".repeat(1000),
  );
  git(repo, ["add", "base.ts", "large.test.ts"]);
  git(repo, [
    "-c",
    "user.name=Smoke",
    "-c",
    "user.email=smoke@example.invalid",
    "commit",
    "-qm",
    "base",
  ]);
  await withInstalledTool(
    { actionPath, tempRoot: scratch },
    async ({ root, expected, env }) => {
      const manifest = await verifyInstalledTool(root, expected);
      assert.equal(existsSync(join(root, "node_modules/prettier")), false);
      assert.equal(existsSync(join(root, "test")), false);
      const execute = (path, args = [], extra = {}) =>
        spawnSync(process.execPath, [join(root, path), ...args], {
          cwd: repo,
          env: { ...env, ...extra },
          encoding: "utf8",
          windowsHide: true,
          timeout: 180000,
        });
      const clean = execute("bin/quality-ratchet.mjs", [
        "check",
        "--base",
        "HEAD",
        "--json",
      ]);
      assert.equal(clean.status, 0, clean.stderr);
      assert.equal(JSON.parse(clean.stdout).strictExitCode, 0);
      const warnings = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
        import { publishWarnings } from ${JSON.stringify(pathToFileURL(join(root, "scripts/run-action.mjs")).href)};
        import { readFileSync } from "node:fs";
        await publishWarnings(JSON.parse(readFileSync(0, "utf8")));
      `,
        ],
        { env, input: clean.stdout, encoding: "utf8", windowsHide: true },
      );
      assert.equal(warnings.status, 0, warnings.stderr);
      assert.match(
        warnings.stdout,
        /^::warning file=large.test.ts,line=1::.*1000/,
      );
      const block =
        Array.from(
          { length: 20 },
          (_, index) => `export const item${index} = "value-${index}";`,
        ).join("\n") + "\n";
      for (const name of ["copy-a.ts", "copy-b.ts"])
        writeFileSync(join(repo, name), block);
      const regression = execute("bin/quality-ratchet.mjs", [
        "check",
        "--base",
        "HEAD",
        "--json",
      ]);
      assert.equal(regression.status, 1, regression.stderr);
      assert.ok(
        JSON.parse(regression.stdout).scanners.find(
          (item) => item.name === "duplication",
        ).report.findings.length > 0,
      );
      const event = join(scratch, "event.json");
      writeFileSync(event, "{}");
      const failed = execute("scripts/run-action.mjs", [], {
        QR_EXPECTED_MANIFEST: JSON.stringify(expected),
        QR_REPOSITORY_PATH: repo,
        QR_REPORT_DIRECTORY: reports,
        QR_TEMP_ROOT: scratch,
        GITHUB_EVENT_PATH: event,
        GITHUB_EVENT_NAME: "push",
      });
      assert.equal(failed.status, 0, failed.stderr);
      const evidence = JSON.parse(
        readFileSync(join(reports, "quality-evidence.json"), "utf8"),
      );
      assert.equal(evidence.result.exitCode, 2);
      assert.equal(
        execute("scripts/finish-action.mjs", [], {
          QR_REPORT_DIRECTORY: reports,
        }).status,
        2,
      );
      console.log(
        JSON.stringify({
          ...manifest,
          smoke: "passed",
          durationMs: Math.round(performance.now() - started),
        }),
      );
    },
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
