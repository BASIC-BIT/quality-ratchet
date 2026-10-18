import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveComparison } from "../../src/git/comparison.mjs";
import { resolvePolicy } from "../../src/config/resolve.mjs";
import { scanDuplication } from "../../src/duplication/scanner.mjs";
import {
  withRepo as makeRepo,
  write as writeFile,
  commit,
  git,
} from "./repo.mjs";
export { commit, git };
export const toolRoot = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);
export const withRepo = (fn) => () =>
  makeRepo(async (repo) => {
    git(repo, "config", "user.name", "Test");
    git(repo, "config", "user.email", "test@example.invalid");
    return fn(repo);
  });
export const write = (dir, name, text) => writeFile(dir, "src/" + name, text);
export async function scan(dir, base = "HEAD", input = {}) {
  return scanDuplication({
    comparison: resolveComparison({ repo: dir, base }),
    policy: resolvePolicy({ schemaVersion: 1, ...input }),
    toolRoot,
  });
}
export async function exec(dir, args) {
  const i = args.indexOf("--base");
  const report = await scan(dir, args[i + 1]);
  const text = report.findings.length
    ? report.findings
        .map(
          (f) =>
            `${f.verdict === "added-twice" ? "ADDED TWICE" : "DUPLICATES EXISTING"} ${f.a} ${f.b}`,
        )
        .join("\n")
    : "No duplication introduced";
  return {
    code: report.findings.length ? 1 : 0,
    stdout: args.includes("--json") ? JSON.stringify(report) : text,
    stderr: "",
  };
}
export const run = (dir, ...args) => exec(dir, ["--base", "main~1", ...args]);
export async function assertFlags(dir, pattern, ...args) {
  const r = await run(dir, ...args);
  assert.equal(r.code, 1, r.stdout);
  assert.match(r.stdout, pattern);
  return r.stdout;
}
export async function assertClean(dir, ...args) {
  const r = await run(dir, ...args);
  assert.equal(r.code, 0, r.stdout);
}
import assert from "node:assert/strict";
export {
  body,
  replacementBody,
  inlineBoundaryBody,
  divisionArrayBody,
  pythonBody,
} from "../fixtures/duplication/bodies.mjs";
