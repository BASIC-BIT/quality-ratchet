import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { write, commit, git } from "./helpers/repo.mjs";
import { git as safeGit } from "../src/git/commands.mjs";
import { preparePrComparison, verifyPrepared } from "../src/github/prepare.mjs";
import { readCurrentPr } from "../src/github/client.mjs";
test("merge-base baseline preserves source, index and configuration", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event } = input,
      branchPoint = event.pull_request.head.sha;
    git(checkout, "checkout", "--detach", branchPoint);
    write(checkout, "src/feature.ts", "export const feature = 1;\n");
    const head = commit(checkout);
    git(checkout, "update-ref", "refs/pull/7/head", head);
    event.pull_request.head.sha = head;
    git(checkout, "checkout", "-q", "main");
    write(checkout, "src/target.ts", "export const target = 7;\n");
    const tip = commit(checkout);
    git(checkout, "checkout", "--detach", head);
    write(checkout, "src/base.ts", "dirty caller\n");
    const config = readFileSync(join(checkout, ".git/config")),
      index = readFileSync(join(checkout, ".git/index"));
    const prepared = await preparePrComparison(input);
    try {
      assert.equal(prepared.scanned.baseSha, branchPoint);
      assert.equal(prepared.scanned.baseTipSha, tip);
      assert.equal(prepared.scanned.headSha, head);
      verifyPrepared(prepared);
      assert.equal(
        safeGit(prepared.context.comparison.repo, [
          "cat-file",
          "blob",
          prepared.scanned.treeSha + ":src/feature.ts",
        ]),
        "export const feature = 1;\n",
      );
      assert.throws(() =>
        safeGit(prepared.context.comparison.repo, [
          "cat-file",
          "blob",
          prepared.scanned.treeSha + ":src/target.ts",
        ]),
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
test("current PR metadata is one read and carries no target SHA", async () => {
  const paths = [];
  const current = await readCurrentPr({
    token: "SECRET",
    owner: "owner",
    repo: "repo",
    number: 7,
    transport: async (path) => {
      paths.push(path);
      return {
        head: { sha: "a".repeat(40) },
        base: { ref: "topic/slash" },
        labels: [{ name: "quality-exception" }],
        body: "$(inert)",
      };
    },
  });
  assert.deepEqual(paths, ["/repos/owner/repo/pulls/7"]);
  assert.equal(current.baseRef, "topic/slash");
  assert.equal(current.baseSha, undefined);
  assert.equal(current.body, "$(inert)");
  assert.deepEqual(current.labels, ["quality-exception"]);
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
test("real head race and invalid config clean temporary sources", async () =>
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
    // The same file edited on both sides no longer simulates a merge, so a
    // conflicting target edit is prepared against the merge base instead.
    git(checkout, "checkout", "--detach", original);
    write(checkout, "src/base.ts", "export const conflict = 3;\n");
    const conflict = commit(checkout);
    event.pull_request.head.sha = conflict;
    git(checkout, "update-ref", "refs/pull/7/head", conflict);
    const prepared = await preparePrComparison(input);
    try {
      assert.equal(prepared.scanned.baseSha, original);
      assert.equal(prepared.scanned.baseTipSha, next);
      verifyPrepared(prepared);
    } finally {
      prepared.cleanup();
    }
    assert.deepEqual(readdirSync(tempRoot), []);
  }));
test("an unresolvable merge base fails and never falls back to the tip", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event } = input;
    git(checkout, "checkout", "-q", "--orphan", "unrelated");
    write(checkout, "src/orphan.ts", "export const orphan = 1;\n");
    const orphan = commit(checkout);
    git(checkout, "update-ref", "refs/pull/7/head", orphan);
    event.pull_request.head.sha = orphan;
    await assert.rejects(preparePrComparison(input), /preparation failed/);
    assert.deepEqual(readdirSync(input.tempRoot), []);
    const output = await runHosted(input);
    assert.equal(output.result.outcome, "error");
    assert.equal(output.result.exitCode, 2);
    assert.equal(output.scanned, null);
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
test("retarget and head races are stale after real scans", async () =>
  withHostedRepo(async (input) => {
    const { checkout } = input;
    git(checkout, "branch", "other");
    for (const mutation of [
      { head: { sha: "a".repeat(40) } },
      { base: { ref: "other" } },
    ]) {
      const output = await runHosted({
        ...input,
        githubTransport: async (path) => ({
          ...(await input.githubTransport(path)),
          ...mutation,
        }),
      });
      assert.equal(output.result.outcome, "stale");
      assert.match(output.result.message, /Rerun/);
    }
  }));
const postScanFetch = (args) =>
  args.some((arg) => arg.includes("refs/quality/current-"));
const tightenedPolicy =
  JSON.stringify({
    schemaVersion: 1,
    checks: { fileSize: { maxLines: 400 } },
  }) + "\n";
/** Commits a pull-request head on a detached base and points the event at it. */
function branchHead(input, base) {
  const { checkout, event } = input;
  git(checkout, "checkout", "--detach", base);
  write(checkout, "src/feature.ts", "export const feature = 1;\n");
  const head = commit(checkout);
  git(checkout, "update-ref", "refs/pull/7/head", head);
  event.pull_request.head.sha = head;
  return head;
}
/** Commits a target-branch configuration, then restores the detached head. */
function commitTargetConfig(input, head, text) {
  const { checkout } = input;
  git(checkout, "checkout", "-q", "main");
  write(checkout, "quality-ratchet.json", text);
  const tip = commit(checkout);
  git(checkout, "checkout", "--detach", head);
  return tip;
}
/**
 * Moves the target branch while the run is in flight, either at the live
 * pull-request read or at the post-scan baseline fetch, and reports how many
 * times that moment was reached.
 */
async function runWithTargetMove(input, tip, postScan = false) {
  let moves = 0;
  const move = () => {
    moves++;
    git(input.checkout, "update-ref", "refs/heads/main", tip);
  };
  const output = await runHosted({
    ...input,
    transport(repo, args, options) {
      if (postScan && postScanFetch(args)) move();
      return input.transport(repo, args, options);
    },
    githubTransport: async (path) => {
      if (!postScan) move();
      return input.githubTransport(path);
    },
  });
  return { output, moves };
}
test("a target rewind after the scan moves the merge base and is stale", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event } = input;
    const root = event.pull_request.head.sha;
    write(checkout, "src/target.ts", "export const target = 1;\n");
    const tip = commit(checkout);
    const head = branchHead(input, tip);
    // Rewinding the target past the scanned merge base, head untouched.
    const { output, moves } = await runWithTargetMove(input, root, true);
    assert.equal(moves, 1);
    assert.equal(output.scanned.headSha, head);
    assert.equal(output.scanned.baseSha, tip);
    assert.equal(output.current.baseSha, root);
    assert.equal(output.result.outcome, "stale");
    assert.equal(output.result.exitCode, 1);
  }));
test("a target policy the branch never took blocks instead of passing", async () =>
  withHostedRepo(async (input) => {
    const head = branchHead(input, input.event.pull_request.head.sha);
    commitTargetConfig(input, head, tightenedPolicy);
    const output = await runHosted(input);
    assert.notEqual(
      output.scanned.policyHash,
      output.scanned.baseTipPolicyHash,
    );
    assert.equal(output.result.outcome, "policy-divergence");
    assert.equal(output.result.exitCode, 1);
    assert.match(output.result.message, /Rebase or merge the target branch/);
    assert.equal(
      JSON.parse(readFileSync(output.evidencePath, "utf8")).scanned
        .baseTipPolicyHash,
      output.scanned.baseTipPolicyHash,
    );
  }));
test("a policy merged into the target during the scan still blocks", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event } = input;
    const root = event.pull_request.head.sha;
    const head = branchHead(input, root);
    const tip = commitTargetConfig(input, head, tightenedPolicy);
    git(checkout, "update-ref", "refs/heads/main", root);
    const { output, moves } = await runWithTargetMove(input, tip);
    assert.equal(moves, 1);
    // The target still carried the merge-base policy when the scan started, so
    // only the tip read after the scan can see this tightening.
    assert.equal(output.scanned.baseTipSha, root);
    assert.equal(output.scanned.baseTipPolicyHash, output.scanned.policyHash);
    assert.equal(output.current.baseTipSha, tip);
    assert.notEqual(
      output.current.baseTipPolicyHash,
      output.scanned.policyHash,
    );
    // Nothing else moved: the merge base and the head are both unchanged.
    assert.equal(output.current.baseSha, output.scanned.baseSha);
    assert.equal(output.result.outcome, "policy-divergence");
    assert.equal(output.result.exitCode, 1);
  }));
test("a target configuration that does not resolve never blocks a run", async () =>
  withHostedRepo(async (input) => {
    const head = branchHead(input, input.event.pull_request.head.sha);
    const tip = commitTargetConfig(input, head, "{\n");
    const output = await runHosted(input);
    // The merge base and head tree both parsed, so the scan and its verdict stand.
    assert.equal(output.result.outcome, "clean");
    assert.equal(output.result.exitCode, 0);
    assert.equal(output.scanned.baseTipPolicyHash, null);
    assert.equal(output.current.baseTipSha, tip);
    assert.equal(output.current.baseTipPolicyHash, null);
    assert.equal(output.current.baseTipPolicyUnreadable, true);
    const evidence = JSON.parse(readFileSync(output.evidencePath, "utf8"));
    assert.equal(evidence.scanned.baseTipPolicyHash, null);
    assert.equal(evidence.current.baseTipPolicyUnreadable, true);
    assert.match(
      readFileSync(join(input.directory, "summary.md"), "utf8"),
      /did not resolve at [0-9a-f]{40}, so the policy divergence check did not run/,
    );
    // The saved record publication reads to annotate the run carries both the
    // condition and the SHA it names.
    const saved = JSON.parse(readFileSync(output.reportPath, "utf8"));
    assert.equal(saved.current.baseTipPolicyUnreadable, true);
    assert.equal(saved.current.baseTipSha, tip);
  }));
test("a divergence the post-scan read cannot see still blocks", async () =>
  withHostedRepo(async (input) => {
    const head = branchHead(input, input.event.pull_request.head.sha);
    const tightened = commitTargetConfig(input, head, tightenedPolicy);
    const broken = commitTargetConfig(input, head, "{\n");
    git(input.checkout, "update-ref", "refs/heads/main", tightened);
    // The target tip diverged before the scan and then took a configuration
    // this tool rejects, so the post-scan read resolves no policy at all.
    const { output, moves } = await runWithTargetMove(input, broken, true);
    assert.equal(moves, 1);
    assert.equal(output.scanned.baseTipSha, tightened);
    assert.notEqual(
      output.scanned.baseTipPolicyHash,
      output.scanned.policyHash,
    );
    assert.equal(output.current.baseTipSha, broken);
    assert.equal(output.current.baseTipPolicyHash, null);
    assert.equal(output.current.baseTipPolicyUnreadable, true);
    // Nothing else moved: the merge base and the head are both unchanged.
    assert.equal(output.current.baseSha, output.scanned.baseSha);
    assert.equal(output.result.outcome, "policy-divergence");
    assert.equal(output.result.exitCode, 1);
  }));
test("a target force-pushed to unrelated history is stale, not a read failure", async () =>
  withHostedRepo(async (input) => {
    const { checkout } = input;
    git(checkout, "checkout", "-q", "--orphan", "unrelated");
    // Distinct content: an identical root commit would hash to the branch point.
    write(checkout, "src/orphan.ts", "export const orphan = 1;\n");
    const orphan = commit(checkout);
    git(checkout, "checkout", "-q", "main");
    // Same branch name, so the retarget skip does not apply and the refs arrive.
    const { output, moves } = await runWithTargetMove(input, orphan, true);
    assert.equal(moves, 1);
    assert.equal(output.current.baseSha, null);
    assert.equal(output.current.baseTipSha, null);
    assert.equal(output.current.baseTipPolicyHash, null);
    assert.equal(output.current.baseTipPolicyUnreadable, false);
    assert.equal(output.result.outcome, "stale");
    assert.equal(output.result.exitCode, 1);
    assert.doesNotMatch(output.result.message, /post-scan baseline/);
  }));
test("one post-scan baseline retry keeps the verdict and a second failure is distinct", async () =>
  withHostedRepo(async (input) => {
    let failures = 0;
    const flaky = (allowed) => (repo, args, options) => {
      if (postScanFetch(args) && failures < allowed) {
        failures++;
        throw new Error("SECRET transient");
      }
      return input.transport(repo, args, options);
    };
    const recovered = await runHosted({ ...input, transport: flaky(1) });
    assert.equal(failures, 1);
    assert.equal(recovered.result.outcome, "clean");
    failures = 0;
    const exhausted = await runHosted({ ...input, transport: flaky(2) });
    assert.equal(failures, 2);
    assert.equal(exhausted.result.exitCode, 2);
    assert.match(exhausted.result.message, /post-scan baseline/);
    assert.ok(exhausted.report !== null);
    assert.ok(!readFileSync(exhausted.evidencePath, "utf8").includes("SECRET"));
  }));
test("a retarget to unrelated history is stale, not an evidence failure", async () =>
  withHostedRepo(async (input) => {
    const { checkout } = input;
    git(checkout, "checkout", "-q", "--orphan", "unrelated");
    commit(checkout);
    git(checkout, "checkout", "-q", "main");
    let baselineFetches = 0;
    const output = await runHosted({
      ...input,
      transport(repo, args, options) {
        if (postScanFetch(args)) baselineFetches++;
        return input.transport(repo, args, options);
      },
      githubTransport: async (path) => ({
        ...(await input.githubTransport(path)),
        base: { ref: "unrelated" },
      }),
    });
    assert.equal(baselineFetches, 0);
    assert.equal(output.current.baseSha, null);
    assert.equal(output.result.outcome, "stale");
    assert.equal(output.result.exitCode, 1);
  }));
test("target branch merges during the scan keep the clean verdict", async () =>
  withHostedRepo(async (input) => {
    const { checkout, event } = input;
    const head = event.pull_request.head.sha;
    write(checkout, "src/moved.ts", "export const moved = 1;\n");
    const moved = commit(checkout);
    git(checkout, "update-ref", "refs/heads/main", head);
    const { output, moves: interleaved } = await runWithTargetMove(
      input,
      moved,
    );
    assert.equal(interleaved, 1);
    assert.equal(git(checkout, "rev-parse", "main"), moved);
    assert.equal(output.result.outcome, "clean");
    assert.equal(output.scanned.baseSha, head);
    assert.equal(output.scanned.baseTipSha, head);
    assert.equal(output.current.baseSha, head);
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

test("unsupported hosted runtimes fail before fetching or scanning", async () =>
  withHostedRepo(async (input) => {
    const original = Object.getOwnPropertyDescriptor(process.versions, "node");
    try {
      for (const version of ["24.22.0", "24.21.0", "23.22.1", "25.0.0"]) {
        Object.defineProperty(process.versions, "node", {
          ...original,
          value: version,
        });
        let fetched = false;
        const output = await runHosted({
          ...input,
          transport() {
            fetched = true;
            throw new Error("Unexpected fetch");
          },
        });
        assert.equal(fetched, false, version);
        assert.equal(output.result.exitCode, 2);
        assert.equal(output.report, null);
        assert.equal(output.scanned, null);
      }
    } finally {
      Object.defineProperty(process.versions, "node", original);
    }
  }));
