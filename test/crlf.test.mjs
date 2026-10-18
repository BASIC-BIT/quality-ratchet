import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  withRepo,
  write,
  commit,
  git,
  scanContext,
  toolRoot,
} from "./helpers/repo.mjs";
import { resolvePolicy } from "../src/config/resolve.mjs";
import { resolveComparison, treeComparison } from "../src/git/comparison.mjs";
import { runJscpd, scanDuplication } from "../src/duplication/scanner.mjs";
import { fingerprintScannerEndpoint } from "../src/duplication/identity.mjs";
import { fingerprintCloneSource } from "../src/duplication/normalize.mjs";

const source = (name, title = "Example") => `export function ${name}() {
 return (
  <Panel
   style={{
    height: "auto",
    overflow: "visible",
   }}
  >
   <Header
    title="${title}"
    visible={true}
   />
   <Content
    size="small"
    padded={false}
   />
  </Panel>
 );
}
`;
const crlf = (text) => text.replaceAll("\n", "\r\n");
const opts = { minLines: 8, minTokens: 50, toolRoot };

for (const baselineEol of ["LF", "CRLF"]) {
  test(`${baselineEol} comparison follows Git EOL content and preserves caller state`, () =>
    withRepo((repo) => {
      git(repo, "config", "core.autocrlf", "false");
      const lf =
        "export const first = 1;\nexport const second = 2;\nexport const third = 3;\n";
      write(repo, "src/base.ts", baselineEol === "LF" ? lf : crlf(lf));
      commit(repo);
      git(repo, "config", "core.autocrlf", "true");
      const current = baselineEol === "LF" ? crlf(lf) : lf;
      write(repo, "src/base.ts", current);
      const index = readFileSync(join(repo, ".git/index"));
      const config = readFileSync(join(repo, ".git/config"));
      const comparison = resolveComparison({ repo, base: "HEAD" });
      assert.deepEqual(
        [...comparison.ranges],
        baselineEol === "LF" ? [] : [["src/base.ts", [[1, 3]]]],
      );
      assert.deepEqual(
        [...comparison.ranges.hunks],
        baselineEol === "LF"
          ? []
          : [
              [
                "src/base.ts",
                [{ oldStart: 1, oldCount: 3, newStart: 1, newCount: 3 }],
              ],
            ],
      );
      assert.deepEqual(readFileSync(join(repo, ".git/index")), index);
      assert.deepEqual(readFileSync(join(repo, ".git/config")), config);
      assert.equal(readFileSync(join(repo, "src/base.ts"), "utf8"), current);
      write(repo, "src/base.ts", current.replace("third = 3", "third = 4"));
      const changed = resolveComparison({ repo, base: "HEAD" });
      assert.deepEqual(
        changed.ranges.get("src/base.ts"),
        baselineEol === "LF" ? [[3, 3]] : [[1, 3]],
      );
      assert.deepEqual(changed.ranges.hunks.get("src/base.ts"), [
        baselineEol === "LF"
          ? { oldStart: 3, oldCount: 1, newStart: 3, newCount: 1 }
          : { oldStart: 1, oldCount: 3, newStart: 1, newCount: 3 },
      ]);
    }));
}

test("native JSX endpoint identities survive CRLF materialization", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.tsx", source("alpha"));
    write(repo, "src/b.tsx", source("beta"));
    commit(repo);
    const lfRows = await runJscpd(repo, opts);
    assert.ok(lfRows.length > 0, "fixture must contain a real native clone");
    write(repo, "src/a.tsx", crlf(source("alpha")));
    write(repo, "src/b.tsx", crlf(source("beta")));
    const rows = await runJscpd(repo, opts);
    const identities = (clones) =>
      clones.map(({ as, ae, bs, be, af, bf, lines, tokens }) => ({
        as,
        ae,
        bs,
        be,
        af,
        bf,
        lines,
        tokens,
      }));
    assert.deepEqual(identities(rows), identities(lfRows));
  }));

test("an unchanged JSX clone passes after CRLF conversion while changed and new copies fail", () =>
  withRepo(async (repo) => {
    git(repo, "config", "core.autocrlf", "true");
    write(repo, "src/a.tsx", source("alpha"));
    write(repo, "src/b.tsx", source("beta"));
    commit(repo);
    for (const [path, name] of [
      ["a", "alpha"],
      ["b", "beta"],
    ])
      write(repo, `src/${path}.tsx`, crlf(source(name)));
    const unchanged = await scanDuplication(scanContext(repo));
    assert.equal(unchanged.changedFiles, 0);
    assert.deepEqual(unchanged.findings, []);
    for (const [path, name] of [
      ["a", "alpha"],
      ["b", "beta"],
    ])
      write(repo, `src/${path}.tsx`, crlf(source(name, "Changed")));
    const changed = await scanDuplication(scanContext(repo));
    assert.ok(
      changed.findings.some((finding) => finding.verdict === "added-twice"),
    );
    for (const [path, name] of [
      ["a", "alpha"],
      ["b", "beta"],
    ])
      write(repo, `src/${path}.tsx`, crlf(source(name)));
    write(repo, "src/new.tsx", crlf(source("gamma")));
    const added = await scanDuplication(scanContext(repo));
    assert.ok(
      added.findings.some(
        (finding) => finding.a === "src/new.tsx" || finding.b === "src/new.tsx",
      ),
    );
  }));

test("JSX EOL normalization retains literal bytes and content distinctions", () => {
  assert.equal(
    fingerprintCloneSource(source("alpha"), "tsx"),
    fingerprintCloneSource(crlf(source("alpha")), "tsx"),
  );
  assert.notEqual(
    fingerprintCloneSource(source("alpha"), "tsx"),
    fingerprintCloneSource(source("alpha", "Changed"), "tsx"),
  );
  assert.notEqual(
    fingerprintCloneSource("const value = String.raw`first\rsecond`;", "tsx"),
    fingerprintCloneSource("const value = String.raw`first\nsecond`;", "tsx"),
  );
  for (const literal of [
    "const value = `first\nsecond`;",
    "const value = String.raw`first\nsecond`;",
  ])
    assert.notEqual(
      fingerprintCloneSource(literal, "tsx"),
      fingerprintCloneSource(crlf(literal), "tsx"),
    );
});

test("quoted JSX literal EOL content remains distinct even in partial endpoint spans", () =>
  withRepo(async (repo) => {
    const quoted =
      'export const node = (<Panel\n  title="first\nsecond"\n/>);\n';
    assert.notEqual(
      fingerprintCloneSource(quoted, "tsx"),
      fingerprintCloneSource(crlf(quoted), "tsx"),
    );
    assert.notEqual(
      fingerprintCloneSource(
        quoted.replace("first\nsecond", "first\rsecond"),
        "tsx",
      ),
      fingerprintCloneSource(crlf(quoted), "tsx"),
    );
    for (const fenced of [false, true]) {
      const path = fenced ? "src/literal.md" : "src/literal.tsx";
      const wrap = (text) => (fenced ? "```tsx\n" + text + "```\n" : text);
      const line = fenced ? 2 : 1;
      const endpoint = {
        name: path,
        start: line,
        end: line + 3,
        startLoc: { line, column: 20 },
        endLoc: { line: line + 3, column: 2 },
      };
      write(repo, path, wrap(quoted));
      const lf = await fingerprintScannerEndpoint(
        repo,
        endpoint,
        "tsx",
        new Map(),
      );
      write(repo, path, crlf(wrap(quoted)));
      const windows = await fingerprintScannerEndpoint(
        repo,
        endpoint,
        "tsx",
        new Map(),
      );
      assert.notEqual(lf.fingerprint, windows.fingerprint, path);
    }
  }));

test("Git checkout EOL provenance preserves comment-touched multiline JSX debt", () =>
  withRepo(async (repo) => {
    git(repo, "config", "core.autocrlf", "false");
    const sources = [
      ["a", "alpha"],
      ["b", "beta"],
    ];
    for (const [path, name] of sources)
      write(repo, `src/${path}.tsx`, source(name, "first\nsecond"));
    commit(repo);
    const base = git(repo, "rev-parse", "HEAD");
    assert.ok(!git(repo, "show", "HEAD:src/a.tsx").includes("\r"));
    git(repo, "config", "core.autocrlf", "true");
    git(repo, "config", "core.eol", "crlf");
    for (const [path] of sources) rmSync(join(repo, `src/${path}.tsx`));
    git(repo, "checkout-index", "-f", "--all");
    for (const [path] of sources) {
      const file = `src/${path}.tsx`;
      const text = readFileSync(join(repo, file), "utf8");
      assert.ok(
        text.includes("first\r\nsecond"),
        "real checkout must materialize literal CRLF",
      );
      write(
        repo,
        file,
        text.replace(" return (", " // harmless comment\r\n return ("),
      );
    }
    const index = readFileSync(join(repo, ".git/index"));
    const config = readFileSync(join(repo, ".git/config"));
    const before = sources.map(([path]) =>
      readFileSync(join(repo, `src/${path}.tsx`)),
    );
    const ctx = scanContext(repo, {}, base);
    assert.equal(
      ctx.comparison.ranges.size,
      2,
      "harmless comments must really touch both clones",
    );
    const result = await scanDuplication(ctx);
    assert.deepEqual(result.findings, []);
    assert.deepEqual(readFileSync(join(repo, ".git/index")), index);
    assert.deepEqual(readFileSync(join(repo, ".git/config")), config);
    sources.forEach(([path], i) =>
      assert.deepEqual(readFileSync(join(repo, `src/${path}.tsx`)), before[i]),
    );
    for (const [path] of sources) {
      const file = `src/${path}.tsx`;
      write(
        repo,
        file,
        readFileSync(join(repo, file), "utf8").replace("second", "authored"),
      );
    }
    const changed = await scanDuplication(scanContext(repo, {}, base));
    assert.ok(
      changed.findings.some((finding) => finding.verdict === "added-twice"),
    );
    for (const [path] of sources) {
      const file = `src/${path}.tsx`;
      write(
        repo,
        file,
        readFileSync(join(repo, file), "utf8").replace("authored", "second"),
      );
    }
    write(repo, "src/new.tsx", crlf(source("gamma", "first\nsecond")));
    const added = await scanDuplication(scanContext(repo, {}, base));
    assert.ok(
      added.findings.some(
        (finding) => finding.a === "src/new.tsx" || finding.b === "src/new.tsx",
      ),
    );
  }));

for (const [extension, attr] of [
  ["tsx", "text eol=crlf"],
  ["tsx", "text=auto eol=crlf"],
  ["md", "text eol=crlf"],
]) {
  test(`Git ${attr} preserves touched multiline JSX debt in ${extension}`, () =>
    withRepo(async (repo) => {
      git(repo, "config", "core.autocrlf", "false");
      write(repo, ".gitattributes", `*.${extension} ${attr}\n`);
      const wrap = (text) =>
        extension === "md" ? "```tsx\n" + text + "```\n" : text;
      for (const [path, name] of [
        ["a", "alpha"],
        ["b", "beta"],
      ])
        write(
          repo,
          `src/${path}.${extension}`,
          wrap(source(name, "first\nsecond")),
        );
      commit(repo);
      for (const path of ["a", "b"])
        rmSync(join(repo, `src/${path}.${extension}`));
      git(repo, "checkout-index", "-f", "--all");
      for (const path of ["a", "b"]) {
        const file = `src/${path}.${extension}`;
        const text = readFileSync(join(repo, file), "utf8");
        assert.ok(text.includes("first\r\nsecond"));
        write(
          repo,
          file,
          text.replace(" return (", " // harmless comment\r\n return ("),
        );
      }
      const result = await scanDuplication(scanContext(repo));
      assert.ok(result.scanned > 0);
      assert.deepEqual(result.findings, []);
    }));
}

for (const existingCrlf of [false, true]) {
  test(`authored literal EOL changes block when ${existingCrlf ? "automatic conversion preserves the CRLF index" : "text conversion is disabled"}`, () =>
    withRepo(async (repo) => {
      git(repo, "config", "core.autocrlf", "false");
      if (!existingCrlf) write(repo, ".gitattributes", "*.tsx -text\n");
      for (const [path, name] of [
        ["a", "alpha"],
        ["b", "beta"],
      ]) {
        const text = source(name, "first\nsecond");
        write(repo, `src/${path}.tsx`, existingCrlf ? crlf(text) : text);
      }
      commit(repo);
      git(repo, "config", "core.autocrlf", "true");
      for (const path of ["a", "b"]) {
        const file = `src/${path}.tsx`;
        const text = readFileSync(join(repo, file), "utf8");
        write(
          repo,
          file,
          text.replace(
            existingCrlf ? "first\r\nsecond" : "first\nsecond",
            existingCrlf ? "first\nsecond" : "first\r\nsecond",
          ),
        );
      }
      const result = await scanDuplication(scanContext(repo));
      assert.ok(
        result.findings.some((finding) => finding.verdict === "added-twice"),
      );
    }));
}

test("immutable hosted literal identities are independent of caller EOL configuration", () =>
  withRepo(async (repo) => {
    git(repo, "config", "core.autocrlf", "false");
    for (const [path, name] of [
      ["a", "alpha"],
      ["b", "beta"],
    ])
      write(repo, `src/${path}.tsx`, source(name, "first\nsecond"));
    const baselineSha = commit(repo);
    for (const [path, name] of [
      ["a", "alpha"],
      ["b", "beta"],
    ])
      write(repo, `src/${path}.tsx`, source(name, "first\r\nsecond"));
    const headSha = commit(repo);
    const comparison = treeComparison({
      repo,
      baselineSha,
      headSha,
      baseRef: baselineSha,
      treeSha: headSha,
    });
    const context = { comparison, policy: resolvePolicy(), toolRoot };
    const before = await scanDuplication(context);
    assert.ok(
      before.findings.some((finding) => finding.verdict === "added-twice"),
    );
    git(repo, "config", "core.autocrlf", "true");
    const after = await scanDuplication(context);
    assert.deepEqual(after.currentClones, before.currentClones);
    assert.deepEqual(after.findings, before.findings);
  }));
