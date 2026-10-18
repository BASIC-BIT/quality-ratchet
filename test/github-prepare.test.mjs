import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { write, commit, git } from "./helpers/repo.mjs";
import { git as safeGit } from "../src/git/commands.mjs";
import { preparePrComparison, verifyPrepared } from "../src/github/prepare.mjs";
import { readCurrentPr } from "../src/github/client.mjs";
test("fresh target merge preserves source, index and configuration", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event } = input,
      head = event.pull_request.head.sha;
    write(checkout, "src/target.ts", "export const target = 7;\n");
    const base = commit(checkout);
    git(checkout, "checkout", "--detach", head);
    write(checkout, "src/base.ts", "dirty caller\n");
    const config = readFileSync(join(checkout, ".git/config")),
      index = readFileSync(join(checkout, ".git/index"));
    const prepared = await preparePrComparison(input);
    try {
      assert.equal(prepared.scanned.baseSha, base);
      assert.equal(prepared.scanned.headSha, head);
      verifyPrepared(prepared);
      assert.equal(
        safeGit(prepared.context.comparison.repo, [
          "cat-file",
          "blob",
          prepared.scanned.treeSha + ":src/target.ts",
        ]),
        "export const target = 7;\n",
      );
      assert.deepEqual(readFileSync(join(checkout, ".git/config")), config);
      assert.deepEqual(readFileSync(join(checkout, ".git/index")), index);
      assert.equal(
        readFileSync(join(checkout, "src/base.ts"), "utf8"),
        "dirty caller\n",
      );
    } finally {
      prepared.cleanup();
    }
    assert.deepEqual(readdirSync(input.tempRoot), []);
    let auth;
    await assert.rejects(
      preparePrComparison({
        ...input,
        transport(repo, args, options) {
          auth = options.env;
          throw new Error("SECRET");
        },
      }),
      /preparation failed/,
    );
    assert.deepEqual(auth, {});
    assert.deepEqual(readdirSync(input.tempRoot), []);
  }));
test("live target branch is read independently of stale PR base SHA", async () => {
  const paths = [];
  const current = await readCurrentPr({
    token: "SECRET",
    owner: "owner",
    repo: "repo",
    number: 7,
    transport: async (path) => {
      paths.push(path);
      return paths.length === 1
        ? {
            head: { sha: "a".repeat(40) },
            base: { ref: "topic/slash" },
            labels: [{ name: "quality-exception" }],
            body: "$(inert)",
          }
        : { commit: { sha: "b".repeat(40) } };
    },
  });
  assert.equal(current.baseSha, "b".repeat(40));
  assert.equal(current.body, "$(inert)");
  assert.equal(paths[1], "/repos/owner/repo/branches/topic%2Fslash");
});

import { withHostedRepo } from "./helpers/hosted.mjs";
import { runHosted } from "../src/github/cli.mjs";
test("hosted policy reads live metadata and artifacts omit credentials", async () =>
  withHostedRepo(async (input) => {
    const output = await runHosted(input);
    assert.equal(output.result.outcome, "clean");
    const evidence = readFileSync(output.evidencePath, "utf8");
    assert.ok(!evidence.includes("SECRET"));
    assert.ok(!evidence.includes(input.checkout));
    assert.equal(JSON.parse(evidence).tool.verified, true);
    assert.deepEqual(readdirSync(input.tempRoot), ["output"]);
  }));
test("real head race, invalid config and merge conflict clean temporary sources", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event, tempRoot } = input;
    const original = event.pull_request.head.sha;
    write(checkout, "src/base.ts", "export const changed = 2;\n");
    const next = commit(checkout);
    git(checkout, "update-ref", "refs/pull/7/head", next);
    git(checkout, "checkout", "--detach", original);
    await assert.rejects(preparePrComparison(input), /preparation failed/);
    assert.deepEqual(readdirSync(tempRoot), []);
    write(checkout, "quality-ratchet.json", "{");
    const invalid = commit(checkout);
    event.pull_request.head.sha = invalid;
    git(checkout, "update-ref", "refs/pull/7/head", invalid);
    await assert.rejects(preparePrComparison(input), /preparation failed/);
    assert.deepEqual(readdirSync(tempRoot), []);
    git(checkout, "checkout", "--detach", original);
    write(checkout, "src/base.ts", "export const conflict = 3;\n");
    const conflict = commit(checkout);
    event.pull_request.head.sha = conflict;
    git(checkout, "update-ref", "refs/pull/7/head", conflict);
    await assert.rejects(preparePrComparison(input), /preparation failed/);
    assert.deepEqual(readdirSync(tempRoot), []);
  }));
test("prepared tree alteration and API errors block with missing evidence", async () =>
  withHostedRepo(async (input) => {
    const prepared = await preparePrComparison(input);
    prepared.context.comparison.treeSha = "a".repeat(40);
    assert.throws(() => verifyPrepared(prepared), /changed/);
    prepared.cleanup();
    const output = await runHosted({
      ...input,
      githubTransport: async () => {
        throw new Error("SECRET");
      },
    });
    assert.equal(output.result.exitCode, 2);
    assert.equal(output.current, null);
    assert.ok(!readFileSync(output.evidencePath, "utf8").includes("SECRET"));
    assert.deepEqual(readdirSync(input.tempRoot), ["output"]);
  }));
test("retarget and head and base races are stale after real scans", async () =>
  withHostedRepo(async (input) => {
    for (const mutation of [
      { head: { sha: "a".repeat(40) } },
      { base: { ref: "other" } },
    ]) {
      const output = await runHosted({
        ...input,
        githubTransport: async (path) => ({
          ...(await input.githubTransport(path)),
          ...(path.includes("/pulls/") ? mutation : {}),
        }),
      });
      assert.equal(output.result.outcome, "stale");
      assert.match(output.result.message, /Rerun/);
    }
    const output = await runHosted({
      ...input,
      githubTransport: async (path) =>
        path.includes("/pulls/")
          ? input.githubTransport(path)
          : { commit: { sha: "b".repeat(40) } },
    });
    assert.equal(output.result.outcome, "stale");
  }));
test("malicious ref stays inert and consumer filters cannot execute", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event } = input;
    const bad = {
      ...event,
      pull_request: {
        ...event.pull_request,
        base: { ...event.pull_request.base, ref: "--upload-pack=malicious" },
      },
    };
    await assert.rejects(
      preparePrComparison({ ...input, event: bad }),
      /preparation failed/,
    );
    git(checkout, "config", "filter.attack.clean", "missing-command SECRET");
    git(checkout, "config", "filter.attack.smudge", "missing-command SECRET");
    git(checkout, "config", "filter.attack.required", "true");
    write(checkout, ".gitattributes", "*.ts filter=attack\n");
    const prepared = await preparePrComparison(input);
    verifyPrepared(prepared);
    prepared.cleanup();
    assert.deepEqual(readdirSync(input.tempRoot), []);
  }));

test("failed installed-tool verification blocks before any fetch", async () =>
  withHostedRepo(async (input) => {
    const output = await runHosted({
      ...input,
      toolVerified: false,
      transport() {
        assert.fail("must not fetch");
      },
    });
    assert.equal(output.result.exitCode, 2);
    assert.equal(output.report, null);
    assert.equal(output.scanned, null);
    assert.deepEqual(
      JSON.parse(readFileSync(output.evidencePath, "utf8")).missing,
      ["report", "scanned", "current"],
    );
  }));
