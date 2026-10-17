import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withRepo, git } from "./repo.mjs";
import { git as safeGit } from "../../src/git/commands.mjs";
export async function withHostedRepo(callback) {
  return withRepo(async (checkout) => {
    const head = git(checkout, "rev-parse", "HEAD");
    git(checkout, "update-ref", "refs/pull/7/head", head);
    const tempRoot = mkdtempSync(join(tmpdir(), "quality-hosted-"));
    const event = {
      number: 7,
      repository: { name: "repo", owner: { login: "owner" } },
      pull_request: {
        head: { sha: head },
        base: { ref: "main", repo: { full_name: "owner/repo" } },
      },
    };
    const transport = (repo, args, options) => {
      const copy = [...args],
        url = copy.indexOf("https://github.com/owner/repo.git");
      if (url >= 0) copy[url] = checkout;
      return safeGit(repo, copy, options);
    };
    const input = {
      checkout,
      event,
      tempRoot,
      token: "SECRET",
      transport,
      directory: join(tempRoot, "output"),
      toolVerified: true,
      githubTransport: async (path) =>
        path.includes("/pulls/")
          ? {
              head: { sha: event.pull_request.head.sha },
              base: { ref: event.pull_request.base.ref },
              labels: [],
              body: "",
            }
          : { commit: { sha: git(checkout, "rev-parse", "main") } },
    };
    try {
      return await callback(input);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
}
