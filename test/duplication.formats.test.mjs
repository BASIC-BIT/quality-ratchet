import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  supportedFormats,
  formatExtensions,
  formatNames,
  formatForPath,
} from "../src/duplication/formats.mjs";
import { runJscpd } from "../src/duplication/scanner.mjs";
import { resolvePolicy, matchesScope } from "../src/config/resolve.mjs";
import { withRepo, write, commit } from "./helpers/repo.mjs";
import { scan, body } from "./helpers/duplication.mjs";

// Lexical scanner input, deliberately unique lines and identical two-file pairs.
const lexical =
  Array.from(
    { length: 20 },
    (_, i) => `value${i} = input${i} + offset${i} * result${i};`,
  ).join("\n") + "\n";
test("configured formats cannot silently disappear from native detection", async () => {
  const root = mkdtempSync(join(tmpdir(), "quality-formats-"));
  try {
    const expected = new Map();
    for (const format of supportedFormats) {
      const files = [
        ...(formatNames[format] ?? []),
        ...formatExtensions[format].map((ext) => `source.${ext}`),
      ];
      for (const [index, file] of files.entries()) {
        const route = `${format}/${index}`;
        expected.set(route, { format, file });
        for (const side of ["a", "b"]) {
          const dir = join(root, route, side);
          mkdirSync(dir, { recursive: true });
          const sample = lexical.replaceAll(
            "value",
            format.replaceAll("-", "_") + index + "Value",
          );
          writeFileSync(
            join(dir, file),
            format === "markdown"
              ? "```javascript\n" + sample + "```\n"
              : ["astro", "svelte", "vue"].includes(format)
                ? "<script>\n" + sample + "</script>\n"
                : sample,
          );
        }
      }
    }
    const rows = await runJscpd(root, { minLines: 8, minTokens: 50 });
    for (const [route, { format, file }] of expected) {
      assert.equal(formatForPath(file), format);
      assert.ok(
        rows.some(
          (row) =>
            row.a.startsWith(route + "/") && row.b.startsWith(route + "/"),
        ),
        route + " " + file,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("unrouteable accepted grammar names are rejected by public configuration", () => {
  assert.throws(
    () =>
      resolvePolicy({
        schemaVersion: 1,
        checks: { duplication: { formats: ["abap"] } },
      }),
    /format|enum/i,
  );
  assert.throws(
    () => matchesScope(resolvePolicy(), "duplication", "a.ts", "invented"),
    /Unsupported detected format/,
  );
});
test("MDX and filename-only routes detect actual native clones", async () => {
  for (const path of ["a.mdx", "Dockerfile", "Makefile", "GNUmakefile"])
    await withRepo(async (repo) => {
      const content = (tag) =>
        path.endsWith(".mdx")
          ? "```javascript\n" + body(tag) + "```\n"
          : lexical;
      write(repo, "first/" + path, content("alpha"));
      commit(repo);
      write(repo, "second/" + path, content("beta"));
      const report = await scan(repo);
      assert.ok(report.findings.length, path);
    });
});
test("extensionless and unknown-suffix shebang files survive snapshots and freshness checks", async () => {
  for (const [shebang, format] of [
    ["python3", "python"],
    ["node", "javascript"],
    ["ruby", "ruby"],
    ["bash", "bash"],
    ["perl", "perl"],
    ["php", "php"],
  ]) {
    await withRepo(async (repo) => {
      const source = `#!/usr/bin/env ${shebang}\n${lexical}`;
      write(repo, "script", source);
      commit(repo);
      write(repo, "copy.unrecognized", source);
      const report = await scan(repo);
      assert.ok(report.findings.length, format);
      assert.equal(report.findings[0].aFormat, format);
      assert.equal(
        matchesScope(resolvePolicy(), "complexity", "script", format),
        false,
      );
      assert.equal(
        matchesScope(resolvePolicy(), "file-size", "script", format),
        false,
      );
    });
  }
});

import { resolveComparison } from "../src/git/comparison.mjs";
import { withSourceSnapshot } from "../src/git/snapshot.mjs";
import { listEligiblePaths } from "../src/git/paths.mjs";
import { toolRoot } from "./helpers/duplication.mjs";
test("shebang-selected content is bound to local freshness and remains duplication-only", async () =>
  withRepo(async (repo) => {
    write(repo, "script", "#!/usr/bin/env node\n" + body("alpha"));
    commit(repo);
    const context = {
      comparison: resolveComparison({ repo, base: "HEAD" }),
      policy: resolvePolicy(),
      toolRoot,
    };
    assert.ok(listEligiblePaths(context, "duplication").includes("script"));
    assert.ok(!listEligiblePaths(context, "complexity").includes("script"));
    assert.ok(!listEligiblePaths(context, "file-size").includes("script"));
    write(repo, "script", "#!/usr/bin/env node\n" + body("changed"));
    await assert.rejects(
      withSourceSnapshot(context, () => {}),
      /changed.*Rerun/,
    );
  }));
