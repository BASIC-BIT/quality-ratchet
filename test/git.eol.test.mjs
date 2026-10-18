import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withRepo, write, commit, git, scanContext } from "./helpers/repo.mjs";
import { workingEolProvenance, canonicalGitEol } from "../src/git/eol.mjs";
import { withSourceSnapshot } from "../src/git/snapshot.mjs";

const cases = [
  { name: "autocrlf", autocrlf: "true", want: true },
  { name: "input", autocrlf: "input", want: true },
  { name: "authored CRLF", want: false },
  { name: "unset text", attr: "-text", autocrlf: "true", want: false },
  { name: "explicit CRLF", attr: "text eol=crlf", want: true },
  { name: "explicit LF", attr: "text eol=lf", want: true },
  { name: "auto LF index", attr: "text=auto eol=crlf", want: true },
  { name: "auto CRLF index", attr: "text=auto", indexCrlf: true, want: false },
  {
    name: "autocrlf CRLF index",
    autocrlf: "true",
    indexCrlf: true,
    want: false,
  },
  {
    name: "auto binary",
    autocrlf: "true",
    literal: "first\0second",
    want: false,
  },
  {
    name: "auto lone CR",
    attr: "text=auto",
    literal: "first\rsecond",
    want: false,
  },
  {
    name: "forced binary",
    attr: "text",
    literal: "first\0second",
    indexCrlf: true,
    want: true,
  },
  {
    name: "forced lone CR",
    attr: "text",
    literal: "first\rsecond",
    want: true,
  },
];
for (const row of cases) {
  test(`EOL provenance matches actual Git built-in conversion for ${row.name}`, () =>
    withRepo((repo) => {
      git(repo, "config", "core.autocrlf", "false");
      const path = "src/a.tsx";
      const lf = `export const text = \`${row.literal ?? "first\nsecond"}\`;\n`;
      write(repo, path, row.indexCrlf ? lf.replaceAll("\n", "\r\n") : lf);
      commit(repo);
      if (row.attr) write(repo, ".gitattributes", `*.tsx ${row.attr}\n`);
      git(repo, "config", "core.autocrlf", row.autocrlf ?? "false");
      const bytes = "// current comment\r\n" + lf.replaceAll("\n", "\r\n");
      write(repo, path, bytes);
      const beforeIndex = readFileSync(join(repo, ".git/index"));
      const beforeConfig = readFileSync(join(repo, ".git/config"));
      const provenance = workingEolProvenance(repo, [path]);
      assert.equal(provenance.normalizePaths.has(path), row.want);
      const hash = (args, input) =>
        execFileSync("git", args, {
          cwd: repo,
          input,
          encoding: "utf8",
          env: {
            ...process.env,
            GIT_CONFIG_GLOBAL:
              process.platform === "win32" ? "NUL" : "/dev/null",
            GIT_CONFIG_NOSYSTEM: "1",
            GIT_OPTIONAL_LOCKS: "0",
          },
        }).trim();
      assert.deepEqual(readFileSync(join(repo, ".git/index")), beforeIndex);
      git(repo, "add", "--", path);
      const native = git(repo, "rev-parse", `:${path}`);
      const expected = hash(
        ["hash-object", "--no-filters", "--stdin"],
        provenance.normalizePaths.has(path)
          ? canonicalGitEol(Buffer.from(bytes))
          : Buffer.from(bytes),
      );
      assert.equal(
        native,
        expected,
        "Git itself must agree with the provenance decision",
      );
      assert.deepEqual(readFileSync(join(repo, ".git/config")), beforeConfig);
      assert.equal(readFileSync(join(repo, path), "utf8"), bytes);
    }));
}

for (const mutate of [
  (repo) => git(repo, "config", "core.autocrlf", "true"),
  (repo) => write(repo, ".gitattributes", "*.ts text eol=crlf\n"),
  (repo) => {
    const hash = execFileSync(
      "git",
      ["hash-object", "--no-filters", "-w", "--stdin"],
      { cwd: repo, input: "export const base = 1;\r\n", encoding: "utf8" },
    ).trim();
    git(repo, "update-index", "--cacheinfo", `100644,${hash},src/base.ts`);
  },
]) {
  test("working identity detects relevant EOL configuration, attribute or index drift", () =>
    withRepo(async (repo) => {
      git(repo, "config", "core.autocrlf", "false");
      const context = scanContext(repo);
      mutate(repo);
      await assert.rejects(
        withSourceSnapshot(context, () => assert.fail("stale EOL provenance")),
        /Rerun/,
      );
    }));
}

test("EOL metadata queries preserve literal names and batch only selected sources", () =>
  withRepo((repo) => {
    git(repo, "config", "core.autocrlf", "true");
    const paths = [
      "src/[literal]*.tsx",
      "src/café with spaces.tsx",
      ...Array.from(
        { length: 100 },
        (_, i) => `src/${String(i).padStart(3, "0")}-${"x".repeat(100)}.tsx`,
      ),
    ];
    if (process.platform === "win32") paths[0] = "src/[literal].tsx";
    for (const path of paths) write(repo, path, "export const value = 1;\r\n");
    write(repo, "src/unselected.tsx", "export const unselected = 1;\r\n");
    const provenance = workingEolProvenance(repo, paths);
    assert.deepEqual([...provenance.normalizePaths].sort(), paths.sort());
    assert.ok(!provenance.identity.includes("unselected.tsx"));
  }));

test("effective global EOL data reads retain fsmonitor and filter execution barriers", () =>
  withRepo((repo) => {
    const path = "src/global.tsx";
    write(repo, path, "export const value = 1;\n");
    commit(repo);
    write(repo, path, "export const value = 1;\r\n");
    const moduleUrl = new URL("../src/git/eol.mjs", import.meta.url).href;
    const child = `const {workingEolProvenance} = await import(process.argv[1]); const p=workingEolProvenance(process.argv[2], [process.argv[3]]); console.log(JSON.stringify({paths:[...p.normalizePaths],identity:p.identity}));`;
    const sentinel = join(repo, "executed.txt");
    write(
      repo,
      "tripwire.cjs",
      `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "executed");`,
    );
    const command = `node ${join(repo, "tripwire.cjs").replaceAll("\\", "/")}`;
    for (const attributes of [false, true]) {
      const attrs = join(repo, "global-attributes").replaceAll("\\", "/");
      write(
        repo,
        "global-attributes",
        `*.tsx filter=hostile${attributes ? " text eol=crlf" : ""}\n`,
      );
      write(
        repo,
        ".gitconfig",
        `[core]\n autocrlf = ${attributes ? "false" : "true"}\n attributesFile = ${attrs}\n worktree = ${join(repo, "elsewhere").replaceAll("\\", "/")}\n fsmonitor = ${command}\n[filter "hostile"]\n clean = ${command}\n required = true\n`,
      );
      const result = process
        .getBuiltinModule("node:child_process")
        .spawnSync(
          process.execPath,
          ["--input-type=module", "-e", child, moduleUrl, repo, path],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              HOME: repo,
              USERPROFILE: repo,
              XDG_CONFIG_HOME: join(repo, "xdg"),
            },
          },
        );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.deepEqual(JSON.parse(result.stdout).paths, [path]);
      assert.match(JSON.parse(result.stdout).identity, /w\/crlf/);
      assert.equal(
        process.getBuiltinModule("node:fs").existsSync(sentinel),
        false,
      );
    }
  }));
