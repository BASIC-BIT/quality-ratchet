import test from "node:test";
import assert from "node:assert/strict";
import { withRepo, write, commit } from "./helpers/repo.mjs";
import { scan, body } from "./helpers/duplication.mjs";
const shell = (tag) =>
  `${tag}() {\n` +
  Array.from(
    { length: 14 },
    (_, i) => `  value${i}="${i}"; printf '%s' "$value${i}" # note`,
  ).join("\n") +
  "\n}\n";
const prose = Array.from(
  { length: 15 },
  (_, i) =>
    `## Section ${i}\n\nThe **measured result ${i}** belongs to [this reference ${i}](https://example.invalid/${i}) and describes an authored explanation.\n`,
).join("\n");

test("Markdown layout is ignored while prose and fenced JS, TS and shell copies remain detectable", async () => {
  await withRepo(async (repo) => {
    write(repo, "a.md", prose + "\n```javascript\n" + body("alpha") + "```\n");
    commit(repo);
    write(
      repo,
      "b.md",
      prose +
        "\n```javascript\n" +
        body("beta").replaceAll("trimmed", "changed") +
        "```\n",
    );
    assert.ok(
      (await scan(repo)).findings.some((f) => f.aFormat === "markdown"),
    );
  });
  for (const lang of ["javascript", "typescript", "bash"])
    await withRepo(async (repo) => {
      const content = (tag) =>
        "# " +
        tag +
        "\n\n```" +
        lang +
        "\n" +
        (lang === "bash" ? shell(tag) : body(tag)) +
        "```\n";
      write(repo, "a.md", content("alpha"));
      commit(repo);
      write(repo, "b.md", content("beta"));
      assert.ok(
        (await scan(repo)).findings.some((f) => f.aFormat === lang),
        lang,
      );
    });
  await withRepo(async (repo) => {
    const table = Array.from(
      { length: 20 },
      (_, i) =>
        `| field${i} | value${i} |\n| --- | --- |\n| content${i} | result${i} |`,
    ).join("\n\n");
    write(repo, "a.md", table);
    commit(repo);
    write(
      repo,
      "b.md",
      table
        .replaceAll("field", "other")
        .replaceAll("value", "changed")
        .replaceAll("content", "separate")
        .replaceAll("result", "distinct"),
    );
    assert.equal((await scan(repo)).findings.length, 0);
  });
});
test("shell comment-only edits preserve existing fenced and standalone clone identities", async () => {
  for (const ext of ["sh", "md"])
    await withRepo(async (repo) => {
      const content = (tag) =>
        ext === "md" ? "```bash\n" + shell(tag) + "```\n" : shell(tag);
      write(repo, "a." + ext, content("alpha"));
      write(repo, "b." + ext, content("beta"));
      commit(repo);
      write(
        repo,
        "b." + ext,
        content("beta").replaceAll("# note", "# revised note"),
      );
      const report = await scan(repo);
      assert.ok(report.scanned > 0);
      assert.equal(report.findings.length, 0);
    });
});
test("Razor and Excel-formula native routes preserve unchanged and rewritten identities conservatively", async () => {
  for (const ext of ["razor", "xlsx"])
    await withRepo(async (repo) => {
      const content =
        Array.from(
          { length: 15 },
          (_, i) => `value${i} = input${i} + offset${i};`,
        ).join("\n") + "\n";
      write(repo, "a." + ext, content);
      write(repo, "b." + ext, content);
      commit(repo);
      const unchanged = await scan(repo);
      assert.ok(unchanged.scanned > 0);
      assert.equal(unchanged.findings.length, 0);
      write(repo, "a." + ext, content.replaceAll("offset", "replacement"));
      write(repo, "b." + ext, content.replaceAll("offset", "replacement"));
      assert.ok((await scan(repo)).findings.length, ext);
    });
});

test("pinned native prose-only Markdown omission is recorded rather than claimed as coverage", async () =>
  withRepo(async (repo) => {
    write(repo, "a.md", prose);
    commit(repo);
    write(repo, "b.md", prose);
    const report = await scan(repo);
    assert.equal(report.scanned, 0);
    assert.deepEqual(report.findings, []);
    assert.equal(report.coverage.eligibleFiles, 3);
    assert.ok(
      report.coverage.limitations.includes(
        "markdown-prose-requires-fenced-tokens",
      ),
    );
  }));

test("unlabelled Markdown fences retain native text clone identities", async () =>
  withRepo(async (repo) => {
    const text =
      "```\n" +
      Array.from(
        { length: 15 },
        (_, i) => `value${i} = input${i} + offset${i};`,
      ).join("\n") +
      "\n```\n";
    write(repo, "a.md", text);
    commit(repo);
    write(repo, "b.md", text);
    assert.ok((await scan(repo)).findings.length);
  }));
