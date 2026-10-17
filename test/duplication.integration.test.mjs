import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  withRepo,
  write,
  commit,
  git,
  body,
  replacementBody,
  divisionArrayBody,
  inlineBoundaryBody,
  pythonBody,
  exec,
  run,
  assertFlags,
  assertClean,
} from "./helpers/duplication.mjs";
const maybe = test;
maybe(
  "clean diff passes",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    commit(dir, "base");
    write(dir, "unrelated.js", "export const x = 1;\n");
    commit(dir, "add unrelated");
    await assertClean(dir);
  }),
);

maybe(
  "new code duplicating pre-existing code fails as DUPLICATES EXISTING",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    commit(dir, "base");
    write(dir, "b.js", body("beta"));
    commit(dir, "add duplicate");
    const out = await assertFlags(dir, /DUPLICATES EXISTING/);
    assert.match(out, /src\/b\.js/);
  }),
);

maybe(
  "an inaugural gate checks changes committed before the gate was introduced",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    commit(dir, "base without gate");
    write(dir, "b.js", body("beta"));
    commit(dir, "add duplicate before gate");
    mkdirSync(join(dir, "scripts"), { recursive: true });
    writeFileSync(
      join(dir, "scripts", "dup-gate.mjs"),
      "// gate arrives later\n",
    );
    commit(dir, "introduce gate");

    const { code, stdout } = await exec(dir, ["--base", "main~2"]);
    assert.equal(code, 1, stdout);
    assert.match(stdout, /DUPLICATES EXISTING/);
    assert.match(stdout, /src\/b\.js/);
  }),
);

maybe(
  "duplication in a path containing a space is still detected",
  withRepo(async (dir) => {
    // Regression: git appends a TAB to `+++ b/<path>` when the path has spaces,
    // which used to corrupt the map key and silently pass.
    write(dir, "a.js", body("alpha"));
    commit(dir, "base");
    write(dir, "b copy.js", body("beta"));
    commit(dir, "add duplicate with space in name");
    await assertFlags(dir, /b copy\.js/);
  }),
);

maybe(
  "duplication inside embedded Markdown code maps to the container path",
  withRepo(async (dir) => {
    write(dir, "a.md", `# A\n\n\`\`\`javascript\n${body("alpha")}\`\`\`\n`);
    commit(dir, "base with embedded code");
    write(dir, "b.md", `# B\n\n\`\`\`javascript\n${body("beta")}\`\`\`\n`);
    commit(dir, "add duplicated embedded code");
    await assertFlags(dir, /src\/b\.md/);
  }),
);

maybe(
  "regex literals in embedded Markdown clones retain their language context",
  withRepo(async (dir) => {
    const markdownBody = (tag, call) =>
      `# ${tag}\n\n\`\`\`javascript\n${body(tag).replace(
        "  const trimmed =",
        `  const matched = /[//]/.test(input) && ${call}();\n  const trimmed =`,
      )}\`\`\`\n`;
    write(dir, "a.md", markdownBody("alpha", "old"));
    write(dir, "b.md", markdownBody("beta", "old"));
    commit(dir, "base with embedded regex clone");
    write(dir, "a.md", markdownBody("alpha", "revised"));
    write(dir, "b.md", markdownBody("beta", "revised"));
    commit(dir, "rewrite both embedded regex clones");
    await assertFlags(dir, /ADDED TWICE/);
  }),
);

maybe(
  "embedded clone slices beginning at division retain fenced-program context",
  withRepo(async (dir) => {
    const markdownBody = (tag, note) =>
      `# ${tag}\n\n\`\`\`javascript\n${divisionArrayBody(tag, note)}\`\`\`\n`;
    write(dir, "a.md", markdownBody("alpha", "old note"));
    write(dir, "b.md", markdownBody("beta", "old note"));
    commit(dir, "base with embedded division clone");
    write(dir, "a.md", markdownBody("alpha", "revised note"));
    write(dir, "b.md", markdownBody("beta", "revised note"));
    commit(dir, "revise embedded division comments");
    await assertClean(dir);
  }),
);

maybe(
  "EOF-terminated embedded clones retain fenced-program context",
  withRepo(async (dir) => {
    const markdownBody = (tag, note) =>
      `# ${tag}\n\n\`\`\`javascript\n${divisionArrayBody(tag, note).trim()}`;
    write(dir, "a.md", markdownBody("alpha", "old note"));
    write(dir, "b.md", markdownBody("beta", "old note"));
    commit(dir, "base with unclosed embedded division clone");
    write(dir, "a.md", markdownBody("alpha", "revised note"));
    write(dir, "b.md", markdownBody("beta", "revised note"));
    commit(dir, "revise unclosed embedded division comments");
    await assertClean(dir);
  }),
);

maybe(
  "uncommitted duplication is caught (the documented pre-commit workflow)",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    commit(dir, "base");
    write(dir, "seed.js", "export const s = 1;\n");
    commit(dir, "second");
    // Never committed, and untracked. SKILL.md tells agents to run the gate
    // before committing, and `git diff` alone would not see this at all.
    write(dir, "b.js", body("beta"));
    await assertFlags(dir, /src\/b\.js/);
  }),
);

maybe(
  "uncommitted edits do not desync ranges from committed findings",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    commit(dir, "base");
    write(dir, "b.js", body("beta"));
    commit(dir, "add duplicate");
    // Shift the clone down 20 lines without committing. Ranges derived from
    // HEAD would no longer overlap what the scanner reads in the worktree.
    write(dir, "b.js", "// pad\n".repeat(20) + body("beta"));
    await assertFlags(dir, /src\/b\.js/);
  }),
);

maybe(
  "a diff adding both copies at once reports ADDED TWICE",
  withRepo(async (dir) => {
    write(dir, "seed.js", "export const seed = 1;\n");
    commit(dir, "base");
    write(dir, "a.js", body("alpha"));
    write(dir, "b.js", body("beta"));
    commit(dir, "add both copies");
    await assertFlags(dir, /ADDED TWICE/);
  }),
);

maybe(
  "deleting the only difference between two blocks is detected",
  withRepo(async (dir) => {
    const divergent = body("beta").replace(
      "  const total =",
      `${Array.from({ length: 8 }, (_, i) => `  const unique${i} = ${i};`).join("\n")}\n  const total =`,
    );
    write(dir, "a.js", body("alpha"));
    write(dir, "b.js", divergent);
    commit(dir, "base with divergent blocks");
    write(dir, "b.js", body("beta"));
    commit(dir, "delete divergence");
    await assertFlags(dir, /DUPLICATES EXISTING/);
  }),
);

maybe(
  "rewriting both sides in place creates a new clone identity",
  withRepo(async (dir) => {
    seedExistingClone(dir);
    write(dir, "a.js", replacementBody("alpha"));
    write(dir, "b.js", replacementBody("beta"));
    commit(dir, "replace both implementations with a new duplicate");
    await assertFlags(dir, /ADDED TWICE/);
  }),
);

maybe(
  "shortening a pre-existing clone does not create duplication",
  withRepo(async (dir) => {
    seedExistingClone(dir);
    write(
      dir,
      "b.js",
      body("beta").replace(
        "  const total = parts.reduce((sum, p) => sum + p.length, 0);\n  return { ok: true, reason: null, value: total, parts, count: parts.length };",
        "  const first = parts[0] ?? null;\n  return { ok: true, reason: null, value: first, parts, count: parts.length };",
      ),
    );
    commit(dir, "diverge after the shared prefix");
    await assertClean(dir);
  }),
);

maybe(
  "the same helper written twice in one file is reported",
  withRepo(async (dir) => {
    write(dir, "seed.js", "export const seed = 1;\n");
    commit(dir, "base");
    write(dir, "twice.js", body("alpha") + body("beta"));
    commit(dir, "same helper twice in one file");
    await assertFlags(dir, /twice\.js/);
  }),
);

maybe(
  "pre-existing duplication is NOT reported when the diff does not touch it",
  withRepo(async (dir) => {
    seedExistingClone(dir);
    write(dir, "unrelated.js", "export const x = 1;\n");
    commit(dir, "unrelated change");
    await assertClean(dir);
  }),
);

maybe(
  "CI scans duplication introduced only by combining the PR with the live base",
  withRepo(async (dir) => {
    write(dir, "seed.js", "export const seed = true;\n");
    commit(dir, "shared base");

    git(dir, "checkout", "-q", "-b", "feature");
    write(dir, "feature.js", body("alpha"));
    commit(dir, "feature adds one implementation");

    git(dir, "checkout", "-q", "main");
    write(dir, "base.js", body("beta"));
    commit(dir, "main independently adds the duplicate");
    const mainTip = git(dir, "rev-parse", "main").trim();

    git(dir, "checkout", "-q", "feature");
    git(dir, "merge", "--no-commit", "--no-ff", "main");
    const combined = await exec(dir, ["--base", "main", "--json"]);
    assert.equal(combined.code, 1, combined.stdout + combined.stderr);
    const result = JSON.parse(combined.stdout);
    assert.equal(result.mergeBase, mainTip);
    assert.ok(
      result.findings.some(
        (finding) => finding.verdict === "duplicates-existing",
      ),
    );
  }),
);

maybe(
  "whitespace-only edits to a pre-existing clone do not fail the ratchet",
  withRepo(async (dir) => {
    seedExistingClone(dir);
    write(
      dir,
      "b.js",
      body("beta").replace("const trimmed =", "const    trimmed    ="),
    );
    commit(dir, "reformat existing clone");
    await assertClean(dir);
  }),
);

maybe(
  "comment-only edits to a pre-existing clone do not fail the ratchet",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    write(
      dir,
      "b.js",
      body("beta").replace("  const parts =", "  // old note\n  const parts ="),
    );
    commit(dir, "base with existing duplication");
    write(
      dir,
      "b.js",
      body("beta").replace(
        "  const parts =",
        "  // revised note\n  const parts =",
      ),
    );
    commit(dir, "edit a comment in existing clone");
    await assertClean(dir);
  }),
);

maybe(
  "comment-only edits in non-JS clones use the scanner baseline",
  withRepo(async (dir) => {
    write(dir, "a.py", pythonBody("alpha"));
    write(
      dir,
      "b.py",
      pythonBody("beta").replace("    parts =", "    # old note\n    parts ="),
    );
    commit(dir, "base with existing Python duplication");
    write(
      dir,
      "b.py",
      pythonBody("beta").replace(
        "    parts =",
        "    # revised note\n    parts =",
      ),
    );
    commit(dir, "edit a Python comment in existing clone");
    await assertClean(dir);
  }),
);

maybe(
  "comment-only edits inside both template interpolations stay pre-existing",
  withRepo(async (dir) => {
    const withComment = (tag, note) =>
      body(tag).replace(
        '  const trimmed = String(input ?? "").trim();',
        `  const trimmed = \`\${String(input ?? "") /* ${note} */}\`.trim();`,
      );
    write(dir, "a.js", withComment("alpha", "old note"));
    write(dir, "b.js", withComment("beta", "old note"));
    commit(dir, "base with template interpolation comments");
    write(dir, "a.js", withComment("alpha", "revised note"));
    write(dir, "b.js", withComment("beta", "revised note"));
    commit(dir, "revise both interpolation comments");
    await assertClean(dir);
  }),
);

maybe(
  "comment-only edits in clone slices beginning at division stay pre-existing",
  withRepo(async (dir) => {
    write(dir, "a.js", divisionArrayBody("alpha", "old note"));
    write(dir, "b.js", divisionArrayBody("beta", "old note"));
    commit(dir, "base with division-array clone");
    write(dir, "a.js", divisionArrayBody("alpha", "revised note"));
    write(dir, "b.js", divisionArrayBody("beta", "revised note"));
    commit(dir, "revise both division-array comments");
    await assertClean(dir);
  }),
);

maybe(
  "edits outside exact clone columns stay pre-existing",
  withRepo(async (dir) => {
    write(dir, "a.js", inlineBoundaryBody("alpha", "old-a"));
    write(dir, "b.js", inlineBoundaryBody("beta", "old-b"));
    commit(dir, "base with mid-line clone boundaries");
    write(dir, "a.js", inlineBoundaryBody("alpha", "new-a"));
    write(dir, "b.js", inlineBoundaryBody("beta", "new-b"));
    commit(dir, "edit non-cloned prefixes on both sides");
    const result = await exec(dir, ["--base", "main~1"]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
  }),
);

maybe(
  "an eligible rename maps back to its merge-base path",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    write(dir, "b.js", body("beta"));
    commit(dir, "base with existing production duplicate");
    git(dir, "mv", "src/b.js", "src/renamed.js");
    commit(dir, "rename production helper");
    await assertClean(dir);
  }),
);

maybe(
  "an edited rename may shift an unchanged clone without becoming new duplication",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    write(dir, "b.js", body("beta"));
    commit(dir, "base with existing production duplicate");
    git(dir, "mv", "src/b.js", "src/renamed.js");
    write(
      dir,
      "renamed.js",
      "// renamed module header\n".repeat(3) + body("beta"),
    );
    commit(dir, "rename and shift the existing clone");
    await assertClean(dir);
  }),
);

maybe(
  "a renamed file cannot hide a newly added clone occurrence",
  withRepo(async (dir) => {
    write(dir, "duplicates.js", body("alpha") + body("beta"));
    commit(dir, "base with two occurrences");
    git(dir, "mv", "src/duplicates.js", "src/renamed.js");
    write(dir, "renamed.js", body("alpha") + body("beta") + body("gamma"));
    commit(dir, "rename and add a third occurrence");
    await assertFlags(dir, /renamed\.js/);
  }),
);

maybe(
  "a renamed file cannot hide a replacement clone occurrence",
  withRepo(async (dir) => {
    write(
      dir,
      "duplicates.js",
      body("alpha") + body("beta") + replacementBody("unrelated"),
    );
    commit(dir, "base with two occurrences and unrelated code");
    git(dir, "mv", "src/duplicates.js", "src/renamed.js");
    write(dir, "renamed.js", body("alpha") + body("beta") + body("gamma"));
    commit(dir, "rename and replace unrelated code with a third occurrence");
    await assertFlags(dir, /renamed\.js/);
  }),
);

maybe(
  "an unstaged filesystem rename maps back to its merge-base path",
  withRepo(async (dir) => {
    write(dir, "a.js", body("alpha"));
    write(dir, "b.js", body("beta"));
    commit(dir, "base with existing production duplicate");
    write(dir, "seed.js", "export const seed = 1;\n");
    commit(dir, "second commit for the pre-commit comparison");
    renameSync(join(dir, "src", "b.js"), join(dir, "src", "renamed.js"));
    await assertClean(dir);
  }),
);

function seedExistingClone(dir) {
  write(dir, "a.js", body("alpha"));
  write(dir, "b.js", body("beta"));
  commit(dir, "base with existing duplication");
}
