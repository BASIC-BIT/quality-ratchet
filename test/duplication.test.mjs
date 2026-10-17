import test from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  dedupe,
  filterPreExisting,
  wasFindingPresentAtBase,
} from "../src/duplication/baseline.mjs";
import {
  fingerprintCloneSource,
  normalizedCloneContains,
  fingerprintBashCloneSource,
} from "../src/duplication/normalize.mjs";
import { sliceScannerSource } from "../src/duplication/identity.mjs";
import { isMarkdownTableLayout } from "../src/duplication/markdown.mjs";

test("Markdown layout filtering retains prose and non-table punctuation", () => {
  for (const separator of [
    "| --- | --- |",
    " --- | :---: | ---: ",
    "--- |\r\n|",
  ]) {
    assert.equal(
      isMarkdownTableLayout(separator, {
        start: 1,
        end: separator.split("\n").length,
      }),
      true,
      separator,
    );
  }
  for (const content of [
    "| --- | text |",
    "| --- | 42 |",
    "---",
    "",
    "| |",
    "`| --- |`",
    "| --- | <tag> |",
  ]) {
    assert.equal(
      isMarkdownTableLayout(content, { start: 1, end: 1 }),
      false,
      content,
    );
  }
});

test("Markdown table layout filtering preserves literal code spans", () => {
  const layout = "| --- | :---: |";
  for (const source of [
    "```markdown\n" + layout + "\n```",
    "~~~\n" + layout + "\n~~~",
    "\n    " + layout,
  ]) {
    assert.equal(
      isMarkdownTableLayout(source, { start: 2, end: 2 }),
      false,
      source,
    );
  }
  const inline = "`" + layout + "`";
  assert.equal(
    isMarkdownTableLayout(inline, {
      start: 1,
      end: 1,
      startLoc: { line: 1, column: 1 },
      endLoc: { line: 1, column: inline.length - 1 },
    }),
    false,
  );
  assert.equal(isMarkdownTableLayout(layout, {}), false);
});

test("sliceScannerSource honors exact zero-based scanner columns", () => {
  const source = "prefix cloned start\ncloned middle\ncloned end suffix";
  assert.equal(
    sliceScannerSource(source, {
      start: 1,
      end: 3,
      startLoc: { line: 1, column: 7 },
      endLoc: { line: 3, column: 10 },
    }),
    "cloned start\ncloned middle\ncloned end",
  );
  assert.equal(
    sliceScannerSource("prefix cloned suffix", {
      start: 1,
      end: 1,
      startLoc: { line: 1, column: 7 },
      endLoc: { line: 1, column: 13 },
    }),
    "cloned",
  );
  assert.equal(
    sliceScannerSource(
      "prefix cloned start\r\ncloned middle\r\ncloned end suffix",
      {
        start: 1,
        end: 3,
        startLoc: { line: 1, column: 7 },
        endLoc: { line: 3, column: 10 },
      },
    ),
    "cloned start\r\ncloned middle\r\ncloned end",
    "scanner slices preserve original CRLF bytes inside literal tokens",
  );
});

test("classify keeps same-file duplication but rejects self-matches", () => {
  const ranges = new Map([["x.ts", [[1, 200]]]]);
  const opts = { minLines: 8, includeTests: false };
  const base = { kind: "token", a: "x.ts", b: "x.ts", lines: 20 };
  assert.equal(
    classify([{ ...base, as: 1, ae: 20, bs: 40, be: 60 }], ranges, opts).length,
    1,
  );
  assert.equal(
    classify([{ ...base, as: 1, ae: 20, bs: 10, be: 30 }], ranges, opts).length,
    0,
  );
});

test("classify ignores duplication the diff did not touch", () => {
  const opts = { minLines: 8, includeTests: false };
  const row = {
    kind: "token",
    a: "a.ts",
    as: 1,
    ae: 30,
    b: "b.ts",
    bs: 1,
    be: 30,
    lines: 30,
  };
  assert.equal(classify([row], new Map([["c.ts", [[1, 99]]]]), opts).length, 0);
  assert.equal(
    classify([row], new Map([["b.ts", [[10, 12]]]]), opts)[0].verdict,
    "duplicates-existing",
  );
  assert.equal(
    classify(
      [row],
      new Map([
        ["a.ts", [[1, 5]]],
        ["b.ts", [[1, 5]]],
      ]),
      opts,
    )[0].verdict,
    "added-twice",
  );
});

test("classify reports a touched original plus a new copy as duplicates-existing", () => {
  const ranges = new Map([
    ["new.ts", [[10, 21]]],
    ["original.ts", [[10, 10]]],
  ]);
  ranges.hunks = new Map([
    ["new.ts", [{ oldStart: 10, oldCount: 0, newStart: 10, newCount: 12 }]],
    ["original.ts", [{ oldStart: 10, oldCount: 1, newStart: 10, newCount: 1 }]],
  ]);
  ranges.renames = new Map();
  ranges.renames.hunks = ranges.hunks;
  ranges.renames.newPaths = new Set();
  const [finding] = classify(
    [
      {
        kind: "token",
        a: "new.ts",
        as: 10,
        ae: 21,
        b: "original.ts",
        bs: 10,
        be: 21,
        lines: 12,
        tokens: 60,
      },
    ],
    ranges,
    { minLines: 8, includeTests: false },
  );
  assert.equal(finding.verdict, "duplicates-existing");
});

test("classify reports a replacement-only endpoint plus an inserted copy as added twice", () => {
  const ranges = new Map([
    ["src/a.ts", [[10, 20]]],
    ["src/b.ts", [[30, 40]]],
  ]);
  ranges.hunks = new Map([
    ["src/a.ts", [{ oldStart: 10, oldCount: 11, newStart: 10, newCount: 11 }]],
    ["src/b.ts", [{ oldStart: 30, oldCount: 0, newStart: 30, newCount: 11 }]],
  ]);
  const [finding] = classify(
    [
      {
        kind: "token",
        a: "src/a.ts",
        as: 10,
        ae: 20,
        b: "src/b.ts",
        bs: 30,
        be: 40,
        lines: 11,
        tokens: 55,
      },
    ],
    ranges,
    { includeTests: false, minLines: 8 },
  );
  assert.equal(finding.verdict, "added-twice");
});

test("dedupe collapses overlapping and reversed exact clone pairs", () => {
  const token = {
    kind: "token",
    a: "a.ts",
    as: 5,
    ae: 25,
    b: "b.ts",
    bs: 5,
    be: 25,
    lines: 20,
  };
  const overlapping = { ...token, as: 1, ae: 30, bs: 1, be: 30, lines: 30 };
  const out = dedupe([token, overlapping]);
  assert.equal(out.length, 1);
  // Reversed orientation is the same pair.
  assert.equal(dedupe([token, { ...token, a: "b.ts", b: "a.ts" }]).length, 1);
});

const tokenFinding = (overrides = {}) => ({
  kind: "token",
  a: "src/a.ts",
  as: 10,
  ae: 21,
  af: "stable-a",
  b: "src/b.ts",
  bs: 1,
  be: 12,
  bf: "stable-b",
  lines: 12,
  tokens: 60,
  ...overrides,
});

test("baseline matching translates endpoints across preceding deletions", () => {
  const current = tokenFinding();
  const baseline = { ...current, as: 40, ae: 51 };
  const changes = new Map();
  changes.hunks = new Map([
    ["src/a.ts", [{ oldStart: 10, oldCount: 30, newStart: 9, newCount: 0 }]],
  ]);
  assert.equal(wasFindingPresentAtBase(current, [baseline], changes), true);
});

test("baseline matching preserves preceding offsets across an ignored inner insertion", () => {
  const current = tokenFinding({ ae: 22 });
  const baseline = { ...current, as: 40, ae: 51 };
  const changes = new Map();
  changes.hunks = new Map([
    [
      "src/a.ts",
      [
        { oldStart: 10, oldCount: 30, newStart: 9, newCount: 0 },
        { oldStart: 45, oldCount: 0, newStart: 15, newCount: 1 },
      ],
    ],
  ]);
  assert.equal(wasFindingPresentAtBase(current, [baseline], changes), true);
});

test("a broad rename hunk does not make same-content occurrences interchangeable", () => {
  const current = tokenFinding({
    a: "src/renamed.ts",
    as: 31,
    ae: 42,
    af: "same-content",
  });
  const baseline = { ...current, a: "src/original.ts", as: 1, ae: 12 };
  const renames = new Map([["src/renamed.ts", "src/original.ts"]]);
  renames.hunks = new Map([
    [
      "src/renamed.ts",
      [{ oldStart: 1, oldCount: 60, newStart: 1, newCount: 60 }],
    ],
  ]);
  assert.equal(wasFindingPresentAtBase(current, [baseline], renames), false);
});

test("a stable-path insertion cannot impersonate an old occurrence at the same lines", () => {
  const current = {
    kind: "token",
    a: "src/a.ts",
    as: 10,
    ae: 21,
    af: "same-content",
    b: "src/b.ts",
    bs: 1,
    be: 12,
    bf: "stable-b",
    lines: 12,
    tokens: 60,
  };
  const baseline = { ...current };
  const changes = new Map();
  changes.hunks = new Map([
    ["src/a.ts", [{ oldStart: 10, oldCount: 0, newStart: 10, newCount: 12 }]],
  ]);
  assert.equal(wasFindingPresentAtBase(current, [baseline], changes), false);
});

test("a smaller token clone at merge base does not hide a newly enlarged clone", () => {
  const current = {
    kind: "token",
    a: "src/a.ts",
    as: 1,
    ae: 30,
    b: "src/b.ts",
    bs: 1,
    be: 30,
    lines: 30,
    tokens: 120,
    af: "current-alpha",
    bf: "stable-beta",
  };
  const baseline = {
    ...current,
    as: 1,
    ae: 12,
    bs: 1,
    be: 12,
    lines: 12,
    tokens: 55,
    af: "base-alpha",
  };

  assert.equal(wasFindingPresentAtBase(current, [baseline]), false);
  assert.equal(
    wasFindingPresentAtBase(current, [{ ...baseline, tokens: 120 }]),
    true,
  );
});

test("baseline matching requires one unchanged clone endpoint", () => {
  const current = {
    kind: "token",
    a: "src/a.ts",
    as: 1,
    ae: 20,
    af: "new-alpha",
    b: "src/b.ts",
    bs: 1,
    be: 20,
    bf: "new-beta",
    lines: 20,
    tokens: 80,
  };
  const baseline = { ...current, af: "old-alpha", bf: "old-beta" };
  assert.equal(wasFindingPresentAtBase(current, [baseline]), false);
  assert.equal(
    wasFindingPresentAtBase(current, [{ ...baseline, bf: "new-beta" }]),
    true,
  );
});

test("shortened baseline clones must start and end on token boundaries", () => {
  assert.equal(
    normalizedCloneContains("\0prefix\0value\0", "\0fix\0value\0"),
    false,
  );
  assert.equal(
    normalizedCloneContains("\0value??=fallback\0", "\0value??\0"),
    false,
  );
  assert.equal(normalizedCloneContains("\0obj->member\0", "\0obj-\0"), false);
  assert.equal(
    normalizedCloneContains("\0before\0fix+value\0after\0", "\0fix+value\0"),
    true,
  );
});

test("clone fingerprints ignore comments and whitespace but preserve string contents", async () => {
  assert.equal(
    fingerprintCloneSource(
      'const url = "https://old"; // old note',
      "javascript",
    ),
    fingerprintCloneSource(
      'const   url="https://old"; /* revised note */',
      "javascript",
    ),
  );
  assert.notEqual(
    fingerprintCloneSource('const url = "https://old";', "javascript"),
    fingerprintCloneSource('const url = "https://new";', "javascript"),
  );
  assert.notEqual(
    fingerprintCloneSource("const note = 'it\\'s // old';", "javascript"),
    fingerprintCloneSource("const note = 'it\\'s // new';", "javascript"),
  );
  assert.notEqual(
    fingerprintCloneSource("const slash = /[//]/; return old;", "javascript"),
    fingerprintCloneSource(
      "const slash = /[//]/; return revised;",
      "javascript",
    ),
    "comment-like text in a regex literal must not truncate the fingerprint",
  );
  assert.notEqual(
    fingerprintCloneSource("return /\\/\\//.test(old);", "javascript"),
    fingerprintCloneSource("return /\\/\\//.test(revised);", "javascript"),
  );
  assert.notEqual(
    fingerprintCloneSource("if (ok) /[//]/.test(x) && old();", "javascript"),
    fingerprintCloneSource(
      "if (ok) /[//]/.test(x) && revised();",
      "javascript",
    ),
    "regex literals after control-flow conditions must remain literal",
  );
  assert.notEqual(
    fingerprintCloneSource(
      "if (ok) old(); else /[//]/.test(x) && old();",
      "javascript",
    ),
    fingerprintCloneSource(
      "if (ok) old(); else /[//]/.test(x) && revised();",
      "javascript",
    ),
    "regex literals after else must remain literal",
  );
  assert.notEqual(
    fingerprintCloneSource(
      "do /[//]/.test(x) && old(); while (ok);",
      "javascript",
    ),
    fingerprintCloneSource(
      "do /[//]/.test(x) && revised(); while (ok);",
      "javascript",
    ),
    "regex literals after do must remain literal",
  );
  assert.notEqual(
    fingerprintCloneSource("if (ok) {} /[//]/.test(x) && old();", "javascript"),
    fingerprintCloneSource(
      "if (ok) {} /[//]/.test(x) && revised();",
      "javascript",
    ),
    "regex literals after statement blocks must remain literal",
  );
  assert.notEqual(
    fingerprintCloneSource(
      "class Inner {} /[//]/.test(x) && old();",
      "javascript",
    ),
    fingerprintCloneSource(
      "class Inner {} /[//]/.test(x) && revised();",
      "javascript",
    ),
    "regex literals after class declarations remain literal",
  );
  assert.notEqual(
    fingerprintCloneSource(
      "export default abstract class Inner {} /[//]/.test(x) && old();",
      "typescript",
    ),
    fingerprintCloneSource(
      "export default abstract class Inner {} /[//]/.test(x) && revised();",
      "typescript",
    ),
    "regex literals after modified class declarations remain literal",
  );
  assert.equal(
    fingerprintCloneSource(
      "const ratio = {} / 2 /* old note */ + 3;",
      "javascript",
    ),
    fingerprintCloneSource(
      "const ratio = {} / 2 /* revised note */ + 3;",
      "javascript",
    ),
    "division after an object literal is not a regex literal",
  );
  assert.equal(
    fingerprintCloneSource('const marker = "/["; // old note', "javascript"),
    fingerprintCloneSource(
      'const marker = "/["; // revised note',
      "javascript",
    ),
    "regex recovery does not preserve comments after regex-shaped string contents",
  );
  assert.equal(
    fingerprintCloneSource(
      "const ratio = total / [1, // old note\n2];",
      "javascript",
    ),
    fingerprintCloneSource(
      "const ratio = total / [1, // revised note\n2];",
      "javascript",
    ),
    "division by an array does not turn its line comment into regex content",
  );
  assert.equal(
    fingerprintCloneSource("value = 1 # old note", "python"),
    fingerprintCloneSource("value=1 # revised note", "python"),
  );
  assert.notEqual(
    fingerprintCloneSource("return value;", "javascript"),
    fingerprintCloneSource("returnvalue;", "javascript"),
    "whitespace removal must not merge distinct tokens",
  );
  assert.notEqual(
    fingerprintCloneSource("value + +increment;", "javascript"),
    fingerprintCloneSource("value++increment;", "javascript"),
    "whitespace removal must not merge punctuation tokens",
  );
  assert.notEqual(
    await fingerprintBashCloneSource("echo ${#items[@]} && echo old"),
    await fingerprintBashCloneSource("echo ${#items[@]} && echo new"),
    "Bash parameter-expansion hashes must not truncate the fingerprint",
  );
  assert.equal(
    await fingerprintBashCloneSource("echo '${' # old note"),
    await fingerprintBashCloneSource("echo '${' # revised note"),
    "quoted parameter-expansion text does not preserve a real Bash comment",
  );
  assert.notEqual(
    await fingerprintBashCloneSource("echo ${value#prefix} && echo old"),
    await fingerprintBashCloneSource("echo ${value#prefix} && echo new"),
  );
  assert.notEqual(
    await fingerprintBashCloneSource('echo ${value:-"foo"#old-suffix}'),
    await fingerprintBashCloneSource('echo ${value:-"foo"#new-suffix}'),
    "quoted words do not hide later parameter-expansion hashes",
  );
  assert.notEqual(
    await fingerprintBashCloneSource("echo ${value:-${fallback}#old-suffix}"),
    await fingerprintBashCloneSource("echo ${value:-${fallback}#new-suffix}"),
    "nested expansions keep the outer parameter-expansion hash",
  );
  assert.notEqual(
    await fingerprintBashCloneSource("echo $# && echo old"),
    await fingerprintBashCloneSource("echo $# && echo new"),
  );
  assert.equal(
    await fingerprintBashCloneSource("echo value # old note"),
    await fingerprintBashCloneSource("echo value # revised note"),
  );
  assert.equal(
    await fingerprintBashCloneSource("echo café # old note"),
    await fingerprintBashCloneSource("echo café # revised note"),
    "Bash parser byte offsets align with tokenizer string offsets",
  );
  assert.notEqual(
    await fingerprintBashCloneSource(
      'echo "${value:-$({ printf x; })#old-suffix}"',
    ),
    await fingerprintBashCloneSource(
      'echo "${value:-$({ printf x; })#new-suffix}"',
    ),
    "brace groups inside command substitutions cannot close the outer expansion",
  );
  assert.notEqual(
    fingerprintCloneSource("name: prefix#old-value", "yaml"),
    fingerprintCloneSource("name: prefix#new-value", "yaml"),
    "hashes without YAML comment separation remain scalar content",
  );
  assert.equal(
    fingerprintCloneSource("name: value # old note", "yaml"),
    fingerprintCloneSource("name: value # revised note", "yaml"),
  );
  assert.equal(
    fingerprintCloneSource(
      "const message = `${input /* old note */}`;",
      "javascript",
    ),
    fingerprintCloneSource(
      "const message = `${input /* revised note */}`;",
      "javascript",
    ),
    "comments in template interpolations follow scanner comment normalization",
  );
  assert.equal(
    fingerprintCloneSource("return <div>{value /* old note */}</div>;", "tsx"),
    fingerprintCloneSource(
      "return <div>{value /* revised note */}</div>;",
      "tsx",
    ),
    "TSX closing tags are not parsed as regex literals",
  );
  assert.notEqual(
    fingerprintCloneSource(
      "return <div>https://example.test old</div>;",
      "tsx",
    ),
    fingerprintCloneSource(
      "return <div>https://example.test revised</div>;",
      "tsx",
    ),
    "URL text inside JSX children remains literal content",
  );
  assert.notEqual(
    fingerprintCloneSource("message: |\n  prefix # old-value", "yaml"),
    fingerprintCloneSource("message: |\n  prefix # revised-value", "yaml"),
    "hashes inside YAML block scalars remain literal content",
  );
  assert.notEqual(
    fingerprintCloneSource("message: |2-\n  prefix # old-value", "yaml"),
    fingerprintCloneSource("message: |2-\n  prefix # revised-value", "yaml"),
    "YAML block scalar indentation may precede chomping",
  );
  assert.notEqual(
    fingerprintCloneSource("items:\n  - |\n    prefix # old-value", "yaml"),
    fingerprintCloneSource("items:\n  - |\n    prefix # revised-value", "yaml"),
    "hashes inside YAML sequence block scalars remain literal content",
  );
  assert.notEqual(
    await fingerprintBashCloneSource("cat <<'EOF'\nprefix # old-value\nEOF"),
    await fingerprintBashCloneSource(
      "cat <<'EOF'\nprefix # revised-value\nEOF",
    ),
    "hashes inside Bash heredoc bodies remain literal content",
  );
  assert.notEqual(
    fingerprintCloneSource(
      "const message = `raw /* old */ text`;",
      "javascript",
    ),
    fingerprintCloneSource(
      "const message = `raw /* revised */ text`;",
      "javascript",
    ),
    "comment-like raw template text remains literal content",
  );
});

test("filterPreExisting keeps new findings and counts merge-base matches", () => {
  const existing = {
    kind: "token",
    a: "src/a.ts",
    as: 1,
    ae: 12,
    af: "stable-a",
    b: "src/b.ts",
    bs: 1,
    be: 12,
    bf: "stable-b",
    lines: 12,
    tokens: 60,
  };
  const introduced = { ...existing, a: "src/c.ts", af: "new-c" };
  const result = filterPreExisting([existing, introduced], [existing]);
  assert.equal(result.preExisting, 1);
  assert.deepEqual(result.findings, [introduced]);
});

test("native UTF-8 scanner columns slice Unicode literals exactly", () => {
  const source = 'const label = "caf\u00e9"; const kept = "\u96ea";';
  const start = source.indexOf("const kept");
  const file = {
    start: 1,
    end: 1,
    startLoc: { line: 1, column: Buffer.byteLength(source.slice(0, start)) },
    endLoc: { line: 1, column: Buffer.byteLength(source) },
  };
  assert.equal(sliceScannerSource(source, file), 'const kept = "\u96ea";');
});
