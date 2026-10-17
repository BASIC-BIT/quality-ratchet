import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { scanComplexity } from "../src/scanners/complexity.mjs";
import {
  candidates,
  joinMessages,
  verdicts,
  makeLinter,
  lintSource,
} from "../src/complexity/identity.mjs";
import { encodeScanContext } from "../src/contracts.mjs";
import {
  withRepo,
  write,
  commit,
  git,
  scanContext as context,
  toolRoot,
} from "./helpers/repo.mjs";
import {
  heavy,
  branches,
  handler,
  owned,
  bare,
  service,
} from "./fixtures/functions/bodies.mjs";
const scan = (repo, input = {}, base = "HEAD") =>
  scanComplexity(context(repo, input, base));
const rec = (key, line = 1) => ({
  key,
  start: { line, column: 0 },
  end: { line: line + 5, column: 1 },
});
const metric = (value, line = 1, column = 1) => ({
  ruleId: "complexity",
  message: `Function 'work' has a complexity of ${value}. Maximum allowed is 0.`,
  line,
  column,
});

test("trusted metrics join innermost and disambiguate same-name families", () => {
  const records = [
    {
      key: "outer",
      start: { line: 1, column: 0 },
      end: { line: 10, column: 1 },
    },
    rec("outer#1", 2),
    rec("handler", 20),
    rec("handler", 30),
  ];
  const f = joinMessages(records, [
    metric(3),
    metric(4, 2),
    {
      ruleId: "sonarjs/cognitive-complexity",
      line: 2,
      column: 5,
      message:
        "Refactor this function to reduce its Cognitive Complexity from 6 to the 0 allowed.",
    },
  ]);
  assert.deepEqual(
    f.map((x) => [x.key, x.familySize, x.cyclomatic, x.cognitive]),
    [
      ["outer", 1, 3, 0],
      ["outer#1", 1, 4, 6],
      ["handler", 2, 1, 0],
      ["handler~2", 2, 1, 0],
    ],
  );
});
test("malformed, contradictory and invalid metrics are operational errors", () => {
  for (const m of [
    { ...metric(3), message: "Function too branchy 3" },
    metric(0),
    metric("9007199254740992"),
    { ...metric(3), line: 0 },
    { ...metric(3), column: 0 },
    {
      ...metric(3),
      message: "Function 'work' has a complexity of 3. Maximum allowed is 15.",
    },
    { ...metric(3), message: "garbage complexity of 3." },
  ])
    assert.throws(
      () => joinMessages([rec("work")], [m], "src/a.ts"),
      /metric|message|position/i,
    );
  assert.throws(
    () => joinMessages([rec("work")], [metric(3), metric(4)], "src/a.ts"),
    /conflict/i,
  );
  assert.equal(
    joinMessages([rec("work")], [metric(3), metric(4, 1, 2)])[0].cyclomatic,
    4,
  );
});
test("candidates use independent thresholds and touched ranges; verdicts compare either metric", () => {
  const f = {
    key: "work",
    start: 1,
    end: 10,
    cyclomatic: 16,
    cognitive: 4,
    familySize: 1,
  };
  assert.equal(
    candidates([f], [[20, 21]], { cyclomatic: 15, cognitive: 15 }).length,
    0,
  );
  assert.equal(
    candidates([f], [[1, 2]], { cyclomatic: 16, cognitive: 3 }).length,
    1,
  );
  assert.equal(
    candidates([f], [[1, 2]], { cyclomatic: 16, cognitive: 4 }).length,
    0,
  );
  assert.equal(
    verdicts([f], [{ ...f, cyclomatic: 20, cognitive: 3 }])[0].verdict,
    "GREW",
  );
  assert.equal(verdicts([f], [{ ...f, familySize: 2 }])[0].verdict, "NEW");
  assert.deepEqual(verdicts([f], [f]), []);
});
for (const n of [14, 15])
  test(`new cyclomatic ${n + 1} ${n === 14 ? "passes" : "fails"}`, () =>
    withRepo(async (repo) => {
      write(repo, "src/a.ts", heavy("work", n));
      const report = await scan(repo);
      assert.equal(report.findings.length, n === 14 ? 0 : 1);
      if (n === 15)
        assert.deepEqual(
          [
            report.findings[0].verdict,
            report.findings[0].cyclomatic,
            report.findings[0].cognitive,
          ],
          ["NEW", 16, 15],
        );
    }));
for (const [n, expected] of [
  [19, false],
  [20, false],
  [21, true],
])
  test(`legacy complexity 21 to ${n + 1}`, () =>
    withRepo(async (repo) => {
      write(repo, "src/a.ts", heavy("work", 20));
      commit(repo);
      write(repo, "src/a.ts", heavy("work", n, "return 99;"));
      const report = await scan(repo);
      assert.equal(report.findings.length, expected ? 1 : 0);
      if (expected)
        assert.deepEqual(
          [report.findings[0].verdict, report.findings[0].baseCyclomatic],
          ["GREW", 21],
        );
    }));
test("cognitive growth fails even when cyclomatic shrinks", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", heavy("work", 20));
    commit(repo);
    write(
      repo,
      "src/a.ts",
      `export function work(x: number) {\n${"if(x) {\n".repeat(6)}return 1;\n${"}\n".repeat(6)}return 0;\n}\n`,
    );
    const f = (await scan(repo)).findings[0];
    assert.ok(f.cyclomatic < f.baseCyclomatic);
    assert.ok(f.cognitive > f.baseCognitive);
  }));
test("inline disables and consumer configs cannot change script-owned measurements", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", "/* eslint-disable */\n" + heavy("work", 16));
    write(
      repo,
      "eslint.config.mjs",
      'throw new Error("consumer config executed");\n',
    );
    write(
      repo,
      "package.json",
      JSON.stringify({
        type: "module",
        eslintConfig: { ignorePatterns: ["**"] },
      }),
    );
    const report = await scan(repo);
    assert.equal(report.findings[0].key, "work");
  }));
test("all eight extensions, tests/stories/fixtures and JSX are measured; shebang is duplication only", () =>
  withRepo(async (repo) => {
    for (const ext of ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"]) {
      const text = heavy("work", 16).replace(": number", "");
      write(
        repo,
        `test/work.${ext}`,
        ext === "cjs" || ext === "cts"
          ? "if (false) return;\n" + text.replace("export ", "")
          : text,
      );
    }
    write(
      repo,
      "src/Page.tsx",
      `export function Page(p: {n: number}) { return <div>\n${Array.from({ length: 16 }, (_, i) => `{p.n === ${i} && <b>${i}</b>}`).join("\n")}\n</div>; }\n`,
    );
    write(repo, "src/a.stories.ts", heavy("story", 16));
    write(repo, "test/fixtures/a.ts", heavy("fixture", 16));
    write(
      repo,
      "scripts/run",
      "#!/usr/bin/env node\n" + heavy("work", 16).replace(": number", ""),
    );
    assert.equal((await scan(repo)).findings.length, 11);
  }));
test("class, object, Convex and nested functions retain distinct lexical owners", () =>
  withRepo(async (repo) => {
    const outer = (name) =>
      `export function ${name}() {\n${heavy("handler", 20).replace("export ", "")}return handler;\n}\n`;
    write(
      repo,
      "src/a.ts",
      owned("listA", 30) + owned("listB", 17) + outer("oldOwner"),
    );
    commit(repo);
    write(
      repo,
      "src/a.ts",
      owned("listB", 20) +
        outer("newOwner") +
        outer("oldOwner") +
        `export const createItem = mutation({args:{},\n${handler(16)}});\n` +
        `export class Svc { run(x: number) {\n${branches(16)}return 0;\n} }\n`,
    );
    const f = (await scan(repo)).findings;
    assert.deepEqual(
      f.map((x) => [x.key, x.verdict]).sort(),
      [
        ["listB.handler", "GREW"],
        ["newOwner/handler", "NEW"],
        ["createItem.handler", "NEW"],
        ["Svc.run", "NEW"],
      ].sort(),
    );
  }));
test("getters and setters have separate identities in classes and objects", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", service(9, 29));
    commit(repo);
    write(repo, "src/a.ts", service(19, 29));
    assert.deepEqual(
      (await scan(repo)).findings.map((f) => [f.key, f.verdict]),
      [["Svc.get x", "GREW"]],
    );
    const linter = makeLinter(repo, toolRoot);
    const f = await lintSource(
      linter,
      `const obj = {get x() {return 1;},set x(v) {}};`,
      join(repo, "src/input.ts"),
    );
    assert.deepEqual(
      f.map((x) => x.key),
      ["obj.get x", "obj.set x"],
    );
  }));
test("renaming a function is new debt; same-name family growth or shrink is conservative", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", heavy("legacy", 20) + bare(20) + bare(20));
    commit(repo);
    write(repo, "src/a.ts", heavy("renamed", 20) + bare(20));
    const f = (await scan(repo)).findings;
    assert.deepEqual(
      f.map((x) => [x.key, x.verdict]).sort(),
      [
        ["renamed", "NEW"],
        ["handler", "NEW"],
      ].sort(),
    );
    write(
      repo,
      "src/a.ts",
      heavy("legacy", 20) +
        bare(20).replace("return 0;", "return 99;").repeat(3),
    );
    assert.equal(
      (await scan(repo)).findings.filter((x) => x.key.startsWith("handler"))
        .length,
      3,
    );
  }));
test("same-name sibling growth and anonymous ordinal caveat stay visible", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", bare(3) + bare(3));
    commit(repo);
    write(repo, "src/a.ts", bare(3) + bare(16));
    assert.equal((await scan(repo)).findings[0].key, "handler~2");
    write(
      repo,
      "src/a.ts",
      `export function outer(xs:number[]) {xs.map(()=>1);return xs.map((x)=>{\n${branches(16)}return 0;\n});}\n`,
    );
    const report = await scan(repo);
    assert.equal(report.findings[0].key, "outer#2");
    assert.ok(
      report.coverage.limitations.includes(
        "anonymous-callbacks-use-source-order",
      ),
    );
  }));
test("assignment, class-field and private-method identities preserve valid repeated metric reports", () =>
  withRepo(async (repo) => {
    write(
      repo,
      "src/a.ts",
      `obj.work = (x:number)=>{\n${branches(16)}return 0;\n};\nexport class Svc {run = (x:number)=>{\n${branches(16)}return 0;\n};\n#hidden(x:number){\n${branches(16)}return 0;\n}}\n`,
    );
    assert.deepEqual(
      (await scan(repo)).findings.map((f) => f.key).sort(),
      ["obj.work", "Svc.run", "Svc.hidden"].sort(),
    );
  }));
test("overlapping thresholds and advisory findings retain effective policy", () =>
  withRepo(async (repo) => {
    write(repo, "packages/web/a.ts", heavy("small", 16));
    write(repo, "packages/web/test/a.test.ts", heavy("big", 21));
    const report = await scan(repo, {
      overrides: [
        {
          files: ["packages/web/**"],
          reason: "package threshold",
          checks: { complexity: { cyclomatic: 20, cognitive: 20 } },
        },
        {
          files: ["**/*.test.ts"],
          reason: "test rollout",
          checks: { complexity: { mode: "advisory", cognitive: 25 } },
        },
      ],
    });
    assert.equal(report.findings.length, 1);
    assert.deepEqual(
      [
        report.findings[0].mode,
        report.findings[0].overrideIndices,
        report.findings[0].thresholds,
        report.findings[0].reason,
      ],
      ["advisory", [0, 1], { cyclomatic: 20, cognitive: 25 }, "test rollout"],
    );
  }));
test("globally off complexity may be enabled in one package", () =>
  withRepo(async (repo) => {
    write(repo, "src/off.ts", heavy("off", 20));
    write(repo, "packages/on/a.ts", heavy("on", 20));
    const report = await scan(repo, {
      checks: { complexity: { mode: "off", reason: "rollout" } },
      overrides: [
        {
          files: ["packages/on/**"],
          reason: "enabled package",
          checks: { complexity: { mode: "ratchet" } },
        },
      ],
    });
    assert.deepEqual(
      report.findings.map((f) => f.key),
      ["on"],
    );
    assert.ok(report.coverage.disabled.some((f) => f.path === "src/off.ts"));
  }));
test("recognized renamed authored file uses destination policy on both sides", () =>
  withRepo(async (repo) => {
    write(repo, "src/old.ts", heavy("work", 20));
    const base = commit(repo);
    git(repo, "mv", "src/old.ts", "src/new.ts");
    write(repo, "src/new.ts", heavy("work", 21));
    const report = await scan(
      repo,
      {
        checks: {
          duplication: { mode: "off", reason: "test scope" },
          fileSize: { mode: "off", reason: "test scope" },
        },
        overrides: [
          {
            files: ["src/old.ts"],
            reason: "old off",
            checks: { complexity: { mode: "off" } },
          },
          {
            files: ["src/new.ts"],
            reason: "destination",
            checks: { complexity: { cyclomatic: 18, cognitive: 18 } },
          },
        ],
      },
      base,
    );
    assert.equal(report.findings[0].verdict, "GREW");
    assert.equal(report.findings[0].baseCyclomatic, 21);
  }));
test("generated or globally excluded promotion remains new complexity debt", () =>
  withRepo(async (repo) => {
    for (const [old, input] of [
      ["build/old.ts", {}],
      ["legacy/old.ts", { scope: { exclude: ["legacy/**"] } }],
    ]) {
      write(repo, old, heavy("work", 20));
      const base = commit(repo);
      write(repo, "src/new.ts", heavy("work", 20));
      git(repo, "rm", old);
      const report = await scan(repo, input, base);
      assert.equal(report.findings[0].verdict, "NEW");
      git(repo, "add", "--all");
      commit(repo);
      git(repo, "rm", "src/new.ts");
      commit(repo);
    }
  }));
test("parser errors fail operationally even for advisory and never echo source", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", "export function SECRET_CONTENT (\n");
    await assert.rejects(
      scan(repo, {
        checks: { complexity: { mode: "advisory", reason: "rollout" } },
      }),
      (e) =>
        /Parsing error/.test(e.message) &&
        !e.message.includes("SECRET_CONTENT"),
    );
  }));
test("missing tool dependency root fails operationally", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", heavy("work", 16));
    const ctx = context(repo);
    ctx.toolRoot = repo;
    await assert.rejects(
      scanComplexity(ctx),
      /dependency|dependencies|module/i,
    );
  }));
test("complexity stdin entry returns measured advisory exit and operational errors", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", heavy("work", 16));
    const ctx = context(repo, {
      checks: { complexity: { mode: "advisory", reason: "rollout" } },
    });
    const run = (input) =>
      spawnSync(
        process.execPath,
        [join(toolRoot, "src/scanners/complexity.mjs")],
        { input, encoding: "utf8" },
      );
    const result = run(encodeScanContext(ctx));
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).findings[0].mode, "advisory");
    const bad = run("{}");
    assert.equal(bad.status, 2);
    assert.equal(bad.stdout, "");
  }));

test("dynamic assignment expressions never enter source-free findings", () =>
  withRepo(async (repo) => {
    const expression = 'pickKey("DISTINCTIVE_PRIVATE_EXPRESSION")';
    write(
      repo,
      "src/a.ts",
      `target[${expression}] = (x:number) => {\n${branches(16)}return 0;\n};\nobj["literalKey"] = (x:number) => {\n${branches(16)}return 0;\n};\n`,
    );
    const report = await scan(repo);
    assert.deepEqual(
      report.findings.map((f) => f.key).sort(),
      ["<module>#1", "obj.literalKey"].sort(),
    );
    assert.ok(
      !JSON.stringify(report).includes("DISTINCTIVE_PRIVATE_EXPRESSION"),
    );
    assert.ok(!JSON.stringify(report).includes("pickKey"));
  }));
test("concurrent scans keep recorder state isolated", () =>
  withRepo(async (repo) => {
    write(repo, "src/a.ts", heavy("alpha", 16));
    write(repo, "src/b.ts", heavy("beta", 17));
    const ctx = context(repo);
    const reports = await Promise.all([
      scanComplexity(ctx),
      scanComplexity(ctx),
    ]);
    assert.deepEqual(reports[0].findings, reports[1].findings);
    assert.deepEqual(reports[0].findings.map((f) => f.key).sort(), [
      "alpha",
      "beta",
    ]);
  }));

test("ESLint ignored paths and out-of-source positions are operational errors", () =>
  withRepo(async (repo) => {
    const linter = makeLinter(repo, toolRoot);
    await assert.rejects(
      lintSource(linter, "const a = 1;", join(repo, "node_modules/a.ts")),
      /ignored/i,
    );
    const fake = {
      records: [],
      lint: { lintText: async () => [{ messages: [metric(3, 1000)] }] },
    };
    await assert.rejects(
      lintSource(fake, "const a = 1;", join(repo, "src/a.ts")),
      /position/i,
    );
  }));

test("destination threshold changes do not turn unchanged authored rename debt into findings", () =>
  withRepo(async (repo) => {
    write(repo, "src/old.ts", heavy("work", 20));
    const base = commit(repo);
    git(repo, "mv", "src/old.ts", "src/new.ts");
    const report = await scan(
      repo,
      {
        checks: {
          duplication: { mode: "off", reason: "test scope" },
          fileSize: { mode: "off", reason: "test scope" },
          complexity: { include: ["src/new.ts"] },
        },
        overrides: [
          {
            files: ["src/new.ts"],
            reason: "destination threshold",
            checks: { complexity: { cyclomatic: 10, cognitive: 10 } },
          },
        ],
      },
      base,
    );
    assert.equal(report.findings.length, 0);
    assert.equal(report.coverage.baselineFiles, 1);
  }));

for (const extension of ["py", "unknown"]) {
  test(`unsupported extension .${extension} promoted to .ts remains new complexity debt`, () =>
    withRepo(async (repo) => {
      const old = `legacy/old.${extension}`;
      write(repo, old, heavy("work", 20));
      const base = commit(repo);
      git(repo, "mv", old, "src/new.ts");
      const ctx = context(repo, {}, base);
      if (extension === "py")
        assert.equal(ctx.comparison.renames.get("src/new.ts"), old);
      else ctx.comparison.renames.set("src/new.ts", old);
      const report = await scanComplexity(ctx);
      assert.equal(report.findings.length, 1);
      assert.equal(report.findings[0].verdict, "NEW");
      assert.equal(report.findings[0].baseCyclomatic, null);
      assert.equal(report.coverage.baselineFiles, 1);
    }));
}
