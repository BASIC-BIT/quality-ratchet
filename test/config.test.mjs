import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateConfig } from "../src/config/validate.mjs";
import {
  resolvePolicy,
  effectiveCheck,
  matchesScope,
  diffPolicies,
} from "../src/config/resolve.mjs";
import {
  supportedFormats,
  nativeFormats as acceptedFormats,
  formatForPath,
} from "../src/duplication/formats.mjs";

const resolve = (input = {}) => resolvePolicy({ schemaVersion: 1, ...input });

test("defaults preserve the approved independent thresholds", () => {
  const p = resolvePolicy({ schemaVersion: 1 });
  assert.deepEqual(effectiveCheck(p, "complexity", "src/a.ts").thresholds, {
    cyclomatic: 15,
    cognitive: 15,
  });
  assert.equal(
    effectiveCheck(p, "file-size", "test/a.test.ts").thresholds.maxLines,
    1000,
  );
  assert.equal(
    effectiveCheck(p, "duplication", "src/a.ts").thresholds.minTokens,
    50,
  );
  assert.equal(
    effectiveCheck(p, "duplication", "src/a.ts").thresholds.minLines,
    8,
  );
  assert.equal(p.reports.testDebt, true);
  assert.deepEqual(p.reports.testSize, { enabled: true, oversizedLines: 1000 });
  assert.equal(resolvePolicy().hash, p.hash);
});

test("unknown keys and missing global reasons fail", () => {
  assert.throws(() => validateConfig({ schemaVersion: 1, unexpected: true }), {
    name: "ConfigurationError",
    exitCode: 2,
  });
  assert.throws(() =>
    resolvePolicy({
      schemaVersion: 1,
      checks: { complexity: { mode: "off" } },
    }),
  );
  for (const input of [
    { checks: { fileSize: { mode: "advisory" } } },
    { reports: { unexpected: true } },
    { scope: { unexpected: true } },
    { checks: { complexity: { thresholds: {} } } },
    { checks: { fileSize: { reason: "   " } } },
  ])
    assert.throws(() => resolve(input));
});

test("last override wins without concatenating arrays", () => {
  const p = resolve({
    scope: { exclude: ["private/**"] },
    checks: { complexity: { include: ["packages/**"] } },
    overrides: [
      {
        files: ["packages/**"],
        reason: "Package policy",
        checks: { complexity: { cyclomatic: 20, cognitive: 21 } },
      },
      {
        files: ["**/*.test.ts"],
        reason: "Test policy",
        checks: { complexity: { cognitive: 25 } },
      },
    ],
  });
  assert.deepEqual(p.scope.exclude, ["private/**"]);
  assert.deepEqual(p.checks.complexity.include, ["packages/**"]);
  assert.deepEqual(effectiveCheck(p, "complexity", "packages/a.test.ts"), {
    mode: "ratchet",
    reason: null,
    thresholds: { cyclomatic: 20, cognitive: 25 },
    overrideIndices: [0, 1],
  });
  assert.equal(matchesScope(p, "complexity", "src/a.ts"), false);
});

test("entry reason supplies advisory reason", () => {
  const p = resolve({
    overrides: [
      {
        files: ["test/**"],
        reason: "Observe tests first",
        checks: { fileSize: { mode: "advisory" } },
      },
    ],
  });
  assert.equal(
    effectiveCheck(p, "file-size", "test/a.ts").reason,
    "Observe tests first",
  );
  assert.equal(effectiveCheck(p, "file-size", "test/a.ts").mode, "advisory");
});

test("inherited advisory reason is retained unless replaced", () => {
  const p = resolve({
    checks: { complexity: { mode: "advisory", reason: "Initial rollout" } },
    overrides: [
      {
        files: ["test/**"],
        reason: "Keep thresholds",
        checks: { complexity: { cyclomatic: 20 } },
      },
      {
        files: ["test/replaced.ts"],
        reason: "Replacement",
        checks: { complexity: { reason: "Package rollout" } },
      },
    ],
  });
  assert.equal(
    effectiveCheck(p, "complexity", "test/a.ts").reason,
    "Initial rollout",
  );
  assert.equal(
    effectiveCheck(p, "complexity", "test/replaced.ts").reason,
    "Package rollout",
  );
});

test("unsupported duplication path override fails", () => {
  assert.throws(() =>
    resolve({
      overrides: [
        {
          files: ["src/**"],
          reason: "No per-path clones",
          checks: { duplication: { minTokens: 100 } },
        },
      ],
    }),
  );
  assert.throws(() =>
    resolve({
      overrides: [
        {
          files: ["src/**"],
          reason: "No discovery override",
          checks: { complexity: { include: ["src/**"] } },
        },
      ],
    }),
  );
});

test("globally off check can be enabled for a package", () => {
  const p = resolve({
    checks: {
      complexity: { mode: "off", reason: "Package rollout" },
      fileSize: { mode: "off", reason: "Later" },
      duplication: { mode: "off", reason: "Later" },
    },
    overrides: [
      {
        files: ["packages/active/**"],
        reason: "Active package",
        checks: { complexity: { mode: "ratchet" } },
      },
    ],
  });
  assert.equal(
    effectiveCheck(p, "complexity", "packages/active/a.ts").mode,
    "ratchet",
  );
  assert.equal(
    effectiveCheck(p, "complexity", "packages/later/a.ts").mode,
    "off",
  );
  assert.throws(() =>
    resolve({
      checks: {
        complexity: { mode: "off", reason: "Later" },
        fileSize: { mode: "off", reason: "Later" },
        duplication: { mode: "off", reason: "Later" },
      },
    }),
  );
});

test("testDebt defaults off with duplication off", () => {
  assert.equal(
    resolve({ checks: { duplication: { mode: "off", reason: "Later" } } })
      .reports.testDebt,
    false,
  );
});

test("explicit testDebt with duplication off fails", () => {
  assert.throws(() =>
    resolve({
      checks: { duplication: { mode: "off", reason: "Later" } },
      reports: { testDebt: true },
    }),
  );
});

test("strict schema rejects invalid values throughout the document", () => {
  for (const input of [
    null,
    [],
    {},
    { schemaVersion: 2 },
    { schemaVersion: "1" },
  ])
    assert.throws(() => validateConfig(input));
  for (const [check, key] of [
    ["complexity", "cyclomatic"],
    ["complexity", "cognitive"],
    ["fileSize", "maxLines"],
    ["duplication", "minLines"],
    ["duplication", "minTokens"],
  ]) {
    for (const value of [0, -1, 1.5, "15", null])
      assert.throws(() => resolve({ checks: { [check]: { [key]: value } } }));
  }
  for (const input of [
    { checks: { duplication: { formats: ["not-a-format"] } } },
    { checks: { duplication: { formats: [] } } },
    { checks: { complexity: { include: [] } } },
    { scope: { include: [] } },
    {
      overrides: [
        { files: [], reason: "Empty", checks: { fileSize: { maxLines: 20 } } },
      ],
    },
    {
      overrides: [
        { files: ["src/**"], checks: { fileSize: { maxLines: 20 } } },
      ],
    },
    { overrides: [{ files: ["src/**"], reason: "Empty", checks: {} }] },
    { reports: { testSize: { oversizedLines: 0 } } },
  ])
    assert.throws(() => resolve(input));
  assert.doesNotThrow(() => resolve({ scope: { exclude: [] }, overrides: [] }));
});

test("glob validation rejects unsafe or unsupported grammar", () => {
  for (const pattern of [
    "/src/**",
    "C:/src/**",
    "C:src/**",
    "//server/share/**",
    "src\\**",
    "../src/**",
    "src/../a.ts",
    "!src/**",
    "@(src)/**",
    "+(src)/**",
    "src/{a,b.ts",
    "src/[ab.ts",
    "src/a].ts",
    "src/a}.ts",
    "",
    "src/\na.ts",
  ]) {
    assert.throws(() => resolve({ scope: { include: [pattern] } }), pattern);
  }
  assert.throws(() =>
    resolve(
      JSON.parse('{"schemaVersion":1,"scope":{"include":["src\\\\**"]}}'),
    ),
  );
  assert.throws(() =>
    resolve({ checks: { complexity: { exclude: ["../**"] } } }),
  );
  assert.throws(() =>
    resolve({
      overrides: [
        {
          files: ["!src/**"],
          reason: "Bad",
          checks: { complexity: { cognitive: 20 } },
        },
      ],
    }),
  );
});

test("scope uses case-sensitive dot-aware globs with literal comments", () => {
  const p = resolve({
    scope: { include: ["{src,test}/**/*.?s", ".config/**", "#config.js"] },
    checks: { complexity: { exclude: ["**/skip.*"] } },
  });
  for (const path of [
    "src/a.ts",
    "test/nested/a.js",
    ".config/a.ts",
    "#config.js",
  ])
    assert.equal(matchesScope(p, "complexity", path), true, path);
  for (const path of ["Src/a.ts", "src/skip.ts", "src/a.py", "other/a.ts"])
    assert.equal(matchesScope(p, "complexity", path), false, path);
  assert.equal(matchesScope(p, "complexity", "src\\a.ts"), true);
  for (const path of [
    "../src/a.ts",
    "src/../a.ts",
    "C:\\src\\a.ts",
    "/src/a.ts",
    "\\\\host\\src\\a.ts",
  ])
    assert.throws(() => matchesScope(p, "complexity", path));
});

test("hard exclusions cannot be restored by scope or overrides", () => {
  const p = resolve({
    scope: { exclude: [] },
    overrides: [
      {
        files: ["**"],
        reason: "Everything",
        checks: { complexity: { mode: "ratchet" } },
      },
    ],
  });
  for (const path of [
    ".git/a.ts",
    "nested/.git/a.ts",
    "node_modules/a.ts",
    "nested/node_modules/a.ts",
    ".worktrees/work/a.ts",
    ".quality-ratchet/tool/a.ts",
    "dist/a.ts",
    "coverage/a.ts",
    "convex/_generated/a.ts",
    "src/a.d.ts",
    "src/a.d.mts",
  ])
    assert.equal(matchesScope(p, "complexity", path), false, path);
  for (const path of [
    "test/a.test.ts",
    "test/fixtures/a.ts",
    "src/a.stories.tsx",
    "scripts/a.mjs",
    "vite.config.ts",
  ])
    assert.equal(matchesScope(p, "complexity", path), true, path);
});

test("scanner language and configured format filters are separate", () => {
  const p = resolve();
  for (const ext of ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"])
    assert.equal(matchesScope(p, "file-size", `a.${ext}`), true);
  for (const path of [
    "a.py",
    "a.ps1",
    "a.tf",
    "a.toml",
    "a.yml",
    "a.css",
    "a.html",
    "a.md",
  ]) {
    assert.equal(matchesScope(p, "duplication", path), true, path);
    assert.equal(matchesScope(p, "complexity", path), false, path);
  }
  assert.equal(
    matchesScope(
      resolve({ checks: { duplication: { formats: ["python"] } } }),
      "duplication",
      "a.ts",
    ),
    false,
  );
  assert.equal(matchesScope(p, "duplication", "a.unknown"), false);
  assert.ok(supportedFormats.includes("hcl"));
  assert.equal(formatForPath("a.cts"), "typescript");
  assert.throws(() => matchesScope(p, "unknown", "a.ts"));
});

test("hashes are stable across object key order and input remains untouched", () => {
  const input = {
    schemaVersion: 1,
    checks: { complexity: { cognitive: 19, cyclomatic: 17 } },
  };
  const before = structuredClone(input);
  assert.equal(
    resolvePolicy(input).hash,
    resolvePolicy({
      checks: { complexity: { cyclomatic: 17, cognitive: 19 } },
      schemaVersion: 1,
    }).hash,
  );
  assert.deepEqual(input, before);
  assert.notEqual(resolve().hash, resolvePolicy(input).hash);
  assert.match(resolve().hash, /^[a-f0-9]{64}$/);
});

test("policy differences describe additions and deletion to defaults", () => {
  const defaults = resolve();
  const configured = resolve({ checks: { complexity: { cognitive: 20 } } });
  assert.deepEqual(diffPolicies(defaults, configured), [
    { path: "checks.complexity.cognitive", before: 15, after: 20 },
  ]);
  assert.deepEqual(diffPolicies(configured, resolvePolicy()), [
    { path: "checks.complexity.cognitive", before: 20, after: 15 },
  ]);
  assert.deepEqual(diffPolicies(defaults, resolve()), []);
});

test("approved example and consumer policy fixtures resolve", () => {
  for (const name of ["approved-example", "chronote", "perkcord"]) {
    const p = resolvePolicy(
      JSON.parse(
        readFileSync(new URL(`fixtures/config/${name}.json`, import.meta.url)),
      ),
    );
    assert.equal(matchesScope(p, "complexity", "test/a.test.ts"), true);
    assert.equal(
      effectiveCheck(p, "file-size", "test/a.test.ts").thresholds.maxLines,
      name === "approved-example" ? 1500 : 1000,
    );
    assert.equal(p.reports.testSize.oversizedLines, 1000);
  }
});

test("configuration inventory matches the pinned native engine", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const nativeFormats = execFileSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/jscpd/run-jscpd.js", import.meta.url),
      ),
      "--list",
    ],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\r?\n/u)
    .sort();
  assert.deepEqual(acceptedFormats, nativeFormats);
  assert.ok(supportedFormats.every((f) => nativeFormats.includes(f)));
  assert.doesNotThrow(() =>
    validateConfig({
      schemaVersion: 1,
      checks: { duplication: { formats: supportedFormats } },
    }),
  );
});

test("MDX participates in the declared Markdown scope", () => {
  assert.equal(formatForPath("docs/a.mdx"), "markdown");
  assert.equal(matchesScope(resolve(), "duplication", "docs/a.mdx"), true);
});

test("all advisory rollout is valid and overrides cannot restore exclusions", () => {
  const p = resolve({
    scope: { exclude: ["private/**"] },
    checks: {
      complexity: { mode: "advisory", reason: "Observe complexity" },
      fileSize: { mode: "advisory", reason: "Observe size" },
      duplication: { mode: "advisory", reason: "Observe clones" },
    },
    overrides: [
      {
        files: ["private/**"],
        reason: "Still excluded",
        checks: { complexity: { mode: "ratchet" } },
      },
    ],
  });
  assert.equal(effectiveCheck(p, "complexity", "src/a.ts").mode, "advisory");
  assert.equal(matchesScope(p, "complexity", "private/a.ts"), false);
});

test("validation does not coerce values, insert defaults, or remove properties", () => {
  const input = { schemaVersion: 1 };
  assert.equal(validateConfig(input), input);
  assert.deepEqual(input, { schemaVersion: 1 });
  for (const candidate of [
    { schemaVersion: 1, checks: { complexity: { mode: "disabled" } } },
    { schemaVersion: 1, checks: { fileSize: { maxLines: "1000" } } },
    { schemaVersion: 1, reports: { testDebt: 1 } },
    { schemaVersion: 1, reports: { testSize: { enabled: "false" } } },
    JSON.parse('{"schemaVersion":1,"__proto__":{"polluted":true}}'),
  ])
    assert.throws(() => validateConfig(candidate));
  const unknown = { schemaVersion: 1, unexpected: true };
  assert.throws(() => validateConfig(unknown));
  assert.equal(unknown.unexpected, true);
});

test("report settings merge independently and array changes stay atomic in differences", () => {
  const p = resolve({
    reports: { testDebt: false, testSize: { enabled: false } },
    checks: { fileSize: { maxLines: 1500 } },
    scope: { exclude: ["private/**"] },
  });
  assert.deepEqual(p.reports, {
    testDebt: false,
    testSize: { enabled: false, oversizedLines: 1000 },
  });
  const scopeChange = diffPolicies(p, resolve()).find(
    (difference) => difference.path === "scope.exclude",
  );
  assert.deepEqual(scopeChange.before, ["private/**"]);
  assert.ok(scopeChange.after.includes("**/*.d.{ts,mts,cts}"));
});

test("explicit override reason wins and later off coverage is visible", () => {
  const p = resolve({
    overrides: [
      {
        files: ["test/**"],
        reason: "Observe first",
        checks: {
          complexity: { mode: "advisory", reason: "Explicit check reason" },
        },
      },
      {
        files: ["test/legacy/**"],
        reason: "Later rollout",
        checks: { complexity: { mode: "off" } },
      },
    ],
  });
  assert.equal(
    effectiveCheck(p, "complexity", "test/a.ts").reason,
    "Explicit check reason",
  );
  assert.deepEqual(effectiveCheck(p, "complexity", "test/legacy/a.ts"), {
    mode: "off",
    reason: "Explicit check reason",
    thresholds: { cyclomatic: 15, cognitive: 15 },
    overrideIndices: [0, 1],
  });
});
