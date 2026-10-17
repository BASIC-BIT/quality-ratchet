# Shared quality-ratchet implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development, selected by the user on 2026-10-17. The implementation plan is approved. Implement task-by-task and track the checkbox steps below. Keep task-scoped reviews and existing publication, merge, and deployment gates.

**Goal:** Publish `BASIC-BIT/quality-ratchet` as one configurable, maintained GitHub Action and move Chronote and Perkcord onto it without silently losing their current checks.

**Architecture:** Extract both repositories' tested Git-relative scanners into an isolated Node tool with a versioned repository-policy file. A root composite action prepares the live proposed merge, executes the tool, applies the persistent PR exception, and publishes evidence. Stage each consumer's policy on its default branch before replacing its local implementation and required-check wiring.

**Tech Stack:** Node.js 24.15.0, ESM JavaScript with JSDoc contracts, npm lockfile, Node test runner, ESLint 10, typescript-eslint, SonarJS, jscpd/tokenizer, Markdown and shell normalization, JSON Schema draft-07 with Ajv, minimatch, and GitHub Actions. Consumer application runtimes and package managers remain unchanged.

**Spec:** [Approved shared-action design](../specs/2026-10-16-quality-ratchet-design.md), approved in chat on October 16, 2026, including the Perkcord comparison and repository-specific configuration revision.

## Review brief

The outcome is a public, versioned action with small configuration and workflow files in each consumer. Checker fixes and behavior tests live once in the shared repo. Each project retains ownership of its thresholds, scope, and enforcement modes.

Execution has three stages: implement and qualify the shared release, prepare both consumers' policies under their existing gates, then migrate the consumers separately. This order makes the target-branch configuration rule work on the first enforced run and preserves a rollback point at each cutover.

The main risks are combining two evolved duplication engines, keeping configuration from weakening its own PR, and moving Perkcord's quality checks out of CI that also runs on main pushes. The tasks below require fixture comparisons and hosted evidence for each. Perkcord's legacy scc/Lizard job stays in place; its 300-line function-length check is not replaced by a file-size limit.

The user approved this plan on 2026-10-17 and selected subagent-driven execution. Implement one scoped task at a time, with task reviews, a fresh review before the initial shared release, and a fresh final review of consumer migration changes. Ordinary repository PR review/readiness requirements still apply. Public repository creation and generic checker extraction are authorized; consumer merges and deployments retain their separate gates.

## Global constraints

- Public repository identity: `BASIC-BIT/quality-ratchet`. Initial local project: `D:/bench/quality-ratchet`; use an isolated checkout for implementation. Preserve dirty primary checkouts of Chronote and Perkcord.
- Include the approved spec and this plan in the new repository. Maintain them there after project creation; leave a pointer in Chronote rather than maintaining divergent copies.
- Default complexity thresholds: cyclomatic 15 and cognitive 15. Default file-size threshold: fewer than 1,000 physical lines for new files; existing oversized files cannot grow. Default duplicate minimums: 8 lines and 50 tokens.
- Default gates include tests, stories, fixtures, scripts, and root configuration. JS/TS complexity/file size support `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts`. Duplication additionally preserves Perkcord's supported scanner formats and normalization cases.
- One `quality-ratchet.json`, schema version 1, owns configurable modes, thresholds, scopes, path overrides, and reports. Both trees use the same policy from the target/baseline commit. Validate and display proposed changes without using them to relax their own PR.
- Modes are `ratchet`, `advisory`, and `off`. Require reasons for advisory/off and for override entries. Advisory operational failures still block. All-advisory rollout is valid and explicit; all-off or wholly empty coverage is invalid.
- No threshold/mode/scope overrides through workflow inputs, environment variables, or strict-check CLI flags. No executable project plugins, source-comment suppressions, or fingerprint-specific allowance registry.
- `quality-exception` plus nonempty text under exact `## Quality exception` accepts PR-wide blocking regressions across pushes. It never accepts operational failures, invalid configuration, stale results, or unrelated CI failures. Agents require explicit human authorization before applying the label, including disposable probes.
- Strict combined exits: 0 for no blocking configured regressions, 1 for blocking regressions, 2 for operational failure. Keep advisory findings and disabled coverage explicit. The PR exception changes only the final policy verdict.
- Composite action supports ordinary read-only `pull_request` execution on GitHub-hosted Ubuntu initially. Local command support includes Windows and Linux. Caller permissions: `contents: read`, `pull-requests: read`; no inherited secrets or application lifecycle execution.
- Caller events: `opened`, `synchronize`, `reopened`, `ready_for_review`, `edited`, `labeled`, `unlabeled`. No path filter. PR concurrency cancels superseded runs. Dedicated job name: `Code quality ratchet`; timeout: 20 minutes; artifact retention: seven days.
- Pinned action code, dependency lockfile, and nested action SHAs supply the executable tool. Resolve scanner dependencies from its temporary tool directory, never the application checkout. Use the same installed scanner versions on both source trees.
- Keep consumer source, index, and Git configuration intact. Do not persist authentication. Treat paths, refs, descriptions, and config as data. Summaries contain locations and measurements, not source snippets. Reports stay in the consuming Actions run.
- Preserve relevant licenses and attribution. Establish the publication rights/provenance of extracted Perkcord material before pushing that source publicly; absence of a root LICENSE is not a permissive license. Do not invent a new license or copy product-specific allowance data into shared code.
- Preserve unrelated checks, branch rules, review rules, and deployment authority. An accepted exception must not be re-gated as a strict delta on a later main push.
- For each merge-ready PR, push the latest commit, wait at least 30 minutes from that commit's timestamp, then refresh all check/review/comment/thread/sticky-summary surfaces for that exact head. Any further commit resets the window. Do not merge consumer PRs or deploy products without applicable authorization.
- Apply unslop to the plan, spec, and substantive reporting after review fixes. No em dashes. Use scoped commits and file-specific staging.

## Review focus

1. A PR raises a threshold, disables a rule, excludes the offending file, or deletes its configuration. Task 2 validates the proposed file; tasks 3 and 7 prove the existing target policy still determines the verdict.
2. An override re-enables a package under a globally disabled check, overlaps another override, or applies after a rename on Windows. Tasks 2, 3, and 5 pin deterministic effective policy and coverage.
3. Project dependencies, scripts, Git attributes, or a hostile path leak into scanner execution. Tasks 3 and 8 prove isolation, safe Git invocation, credential cleanup, and no consumer mutation.
4. A non-JS clone, embedded Markdown fragment, or reviewed Perkcord boundary silently disappears during extraction. Task 4 tests real scanner coverage and compares inherited behavior before removal.
5. Label/rationale/head/base changes race a scan, or an accepted exception fails Perkcord's main-push CI. Tasks 7, 9, and 12 test stale-result handling and post-merge integration rather than relying on one green PR run.

## File ownership and module boundaries

Paths below are relative to the new shared repository unless a consumer is named. Keep modules focused and below the default file-size cap. Split inherited large duplication code by its existing responsibilities while preserving its tests.

| Files                                                                                                                                                    | Responsibility                                                                                                   | Task   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| `package.json`, `package-lock.json`, `.gitignore`, `.nvmrc`, `quality-ratchet.json`, `LICENSE`, `NOTICE`, `docs/provenance.md`                           | Tool installation, supported runtime, self-check policy, source/dependency provenance                            | 1      |
| `schema/quality-ratchet.schema.json`, `src/config/{defaults,validate,resolve,glob}.mjs`, `test/config.test.mjs`                                          | One schema, defaults, supported glob grammar, normalized policy, path overrides                                  | 2      |
| `src/git/{commands,comparison,diff,paths,snapshot}.mjs`, `test/git.test.mjs`, `test/helpers/repo.mjs`                                                    | Safe Git access, comparison identities, eligible source and isolated snapshots                                   | 3      |
| `src/duplication/{scanner,identity,normalize,baseline,markdown,shell,formats}.mjs`, `src/scanners/{entry,duplication}.mjs`, `test/duplication*.test.mjs` | Full-source token clones, format inventory, language normalization, baseline matching, shared subprocess adapter | 4      |
| `src/scanners/{complexity,file-size}.mjs`, `src/complexity/identity.mjs`, `test/{complexity,file-size}.test.mjs`                                         | Complexity and physical-line measurements under effective per-path policy                                        | 5      |
| `src/{contracts,report,runner,cli}.mjs`, `src/reports/{test-debt,test-size}.mjs`, `bin/quality-ratchet.mjs`, `test/{runner,reports,cli}.test.mjs`        | Report validation, aggregate verdict, diagnostics, supported local commands                                      | 6      |
| `src/github/{client,prepare,policy,evidence,summary,cli}.mjs`, `test/{policy,github-prepare,github-summary}.test.mjs`                                    | Live PR/base reads, isolated prepared merge, pure final policy, sanitized evidence                               | 7      |
| `action.yml`, `scripts/{bootstrap-tool,run-action,finish-action}.mjs`, `examples/code-quality.yml`, `test/action.test.mjs`                               | Composite action and consumer workflow contract                                                                  | 8      |
| `.github/workflows/{ci,release-check}.yml`, `.github/dependabot.yml`, `README.md`, `docs/{configuration,local-use,releases,adoption,acceptance}.md`      | Tool checks, release qualification, examples, adoption instructions and evidence                                 | 9      |
| Consumer `quality-ratchet.json` and a short policy note                                                                                                  | Existing enforced consumer settings staged before activation                                                     | 10     |
| Consumer `scripts/run-shared-quality.mjs` and its integration test                                                                                       | Small launcher, expected tool pin, and friendly local setup failure; no measurement or policy code               | 11, 12 |
| Chronote workflow/package/docs and superseded checker files                                                                                              | First consumer migration                                                                                         | 11     |
| Perkcord workflow/package/hook/docs and superseded checker/report files                                                                                  | Second consumer migration, CI aggregation and post-merge behavior                                                | 12     |
| Shared `docs/acceptance.md` and consumer migration notes                                                                                                 | Final review, exact-head readiness, cutover/rollback evidence                                                    | 13     |

## Shared interfaces

Use JSDoc in `src/contracts.mjs` and preserve scanner-specific finding fields. These contracts are the implementation boundary; do not introduce a second representation for the same policy.

- `GateName = "duplication" | "complexity" | "file-size"`; map config keys `duplication`, `complexity`, and `fileSize` explicitly.
- `CheckMode = "ratchet" | "advisory" | "off"`.
- `ResolvedPolicy = { schemaVersion: 1, scope, checks, overrides, reports, hash: string }`. Objects retain the spec's field names and validated settings; `hash` is SHA-256 over a stable recursively key-sorted serialization of resolved policy without `hash`.
- `EffectiveCheck = { mode: CheckMode, reason: string | null, thresholds: object, overrideIndices: number[] }`. Threshold keys are `cyclomatic`/`cognitive`, `maxLines`, or `minLines`/`minTokens`.
- `PolicySelection = { active: ResolvedPolicy, proposed: ResolvedPolicy, configCommit: string, changed: boolean, diff: object[] }`; absence/deletion resolves to defaults. Proposed validation never replaces active enforcement settings.
- `Comparison = { repo: string, baselineSha: string, headSha: string, baseRef: string | null, treeSha: string | null, ranges: Map, renames: Map }`. Local comparisons include eligible working-tree/untracked content; hosted comparisons use a prepared merge tree.
- `ScanContext = { comparison: Comparison, policy: ResolvedPolicy, toolRoot: string }`. Subprocess transport serializes maps as entry arrays and reconstructs them with validation; do not JSON-stringify a Map into an empty object.
- `RunContext = { comparison: Comparison, selection: PolicySelection, toolRoot: string }`. The runner derives each ScanContext with `selection.active`; proposed policy travels in the aggregate report, not into scanner enforcement.
- `GateReport = { base: string, mergeBase: string, policyHash: string, changedFiles: number, scanned: number, coverage: object, findings: object[], preExisting?: number }`. Findings add effective `mode` and `overrideIndices` to the existing scanner-specific fields.
- `ScannerResult = { name: GateName, state: "scanned" | "disabled" | "error", exitCode: 0 | 1 | 2 | null, report: GateReport | null, error: string | null }`. Disabled results have `exitCode: null` and explicit policy/coverage evidence, never fabricated zero findings from a scan that did not run.
- `QualityReport = { schemaVersion: 1, policy: PolicySelection, scanners: ScannerResult[], strictExitCode: 0 | 1 | 2, advisories: object, coverage: object }`.
- `ScannedRevision = { headSha: string, baseRef: string, baseSha: string, treeSha: string, configCommit: string, policyHash: string }`; `CurrentPr = { headSha: string, baseRef: string, baseSha: string, labels: string[], body: string }`.
- `PolicyResult = { exitCode: 0 | 1 | 2, outcome: "clean" | "advisory" | "exception" | "regression" | "invalid-exception" | "stale" | "error", rationale: string | null, message: string }`.

The combined runner expects three distinct scanner records, including policy-justified disabled records. A scanned process exits 0 with no measured regressions, 1 with measured regressions, or 2 for an error. The combined strict verdict considers only findings whose validated effective mode is ratchet, while an enabled scanner/report error always makes it 2. Recompute finding modes and thresholds from active policy rather than trusting contradictory scanner metadata.

### Task 1: Establish the project and reproducible extraction inputs

**Files:** Task-1 files in the map; carry the approved spec and plan into `docs/superpowers/`. Create concise tool-specific `AGENTS.md` using writing-for-agents guidance during execution.

**Interfaces:** Consume the immutable source refs in the evidence appendix. Produce a clean shared checkout with a committed lockfile, documented provenance, and runtime-only dependencies usable independently of either application.

- [ ] **Step 1:** Read execution/worktree guidance and recheck source heads, author identity, existing target-repo identity, and checkout cleanliness. Discover native GitHub repository creation before using any recorded CLI fallback. If the target already exists, inspect ownership/content and reuse only when it is the intended project; never overwrite it.
- [ ] **Step 2:** Inventory extracted files and dependencies, retaining existing notices. Establish the publication-rights basis for private Perkcord source and tests; keep product-specific boundary data and operational material out of the shared repository. If rights for a file cannot be established, resolve that file's provenance before publishing it rather than guessing a license.
- [ ] **Step 3:** Initialize the new isolated project and public repo with default branch `main`, after plan approval. Use source versions for `eslint@10.12.0`, `typescript-eslint@8.71.1`, `typescript@6.0.3`, `eslint-plugin-sonarjs@4.2.0`, `jscpd@5.0.12`, and `@jscpd/tokenizer@4.2.5`. Retain Perkcord's `mdast-util-from-markdown@2.0.3` and `sh-syntax@0.6.0`. Pin `minimatch@10.2.6`; choose and record an exact reviewed Ajv 8 patch for draft-07 validation before committing the lockfile. Keep test/format/lint dependencies separate from runtime dependencies. Stage a self-check policy using the defaults with only `test/fixtures/**` excluded, documenting that these are deliberately duplicated/invalid scanner inputs. Keep the actual test code in scope. This prepares the target policy before the first self-hosted quality run and does not change either consumer's settings.
- [ ] **Step 4:** Run `npm ci --ignore-scripts --omit=dev` in a temporary copy containing only the tool manifest/lockfile. Import every runtime engine, including shell parser assets, with the application checkout absent. Expected: imports work with no lifecycle scripts and no application `node_modules`. Restore the development installation in the tool checkout with `npm ci --ignore-scripts`.
- [ ] **Step 5:** Commit the reproducible project/provenance setup. Establish the minimal default branch needed for PR review, then create `codex/initial-quality-ratchet` for subsequent implementation tasks. Push only material whose public provenance is established. Record the exact dependency versions in `docs/provenance.md`; do not retain floating scanner version ranges.

### Task 2: Implement schema validation and effective policy resolution

**Files:** Task-2 files in the map; `src/contracts.mjs`; `test/fixtures/config/*.json` for meaningful policy examples.

**Interfaces:** Produce `validateConfig(value) -> ConfigInput`, `resolvePolicy(input) -> ResolvedPolicy`, `effectiveCheck(policy, gate, path) -> EffectiveCheck`, and `matchesScope(policy, gate, path) -> boolean`. Invalid data throws an operational configuration error. Use JSON Schema draft-07 with Ajv and no coercion, automatic defaults, property removal, or remote schema loading.

- [ ] **Step 1:** Add failing tests with these exact expectations:

```js
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
assert.throws(() => validateConfig({ schemaVersion: 1, unexpected: true }));
assert.throws(() =>
  resolvePolicy({ schemaVersion: 1, checks: { complexity: { mode: "off" } } }),
);
```

Also name and assert `last override wins without concatenating arrays`, `entry reason supplies advisory reason`, `unsupported duplication path override fails`, `globally off check can be enabled for a package`, `testDebt defaults off with duplication off`, and `explicit testDebt with duplication off fails`.

- [ ] **Step 2:** Run `node --test test/config.test.mjs`. Expected RED: missing implementation or incorrect default/override assertions, not a missing unrelated application dependency.
- [ ] **Step 3:** Implement the schema and resolver. Support only the spec's root/check/report/override keys. Use minimatch with case-sensitive repository-relative `/` paths, dot paths included, and negation/comment interpretation disabled. Support `*`, `?`, `**`, and braces; reject extglobs, absolute/drive/UNC paths, backslash patterns, `..` segments, leading `!`, and unbalanced braces/brackets. Exclusion lists supply exclusion semantics. Deep-merge object fields; replace arrays; apply matching overrides in order.
- [ ] **Step 4:** Add schema/path tests for zero/fractional thresholds, unsupported versions/formats, empty lists, missing reasons, escaped Windows paths, unsupported glob syntax, and hard-excluded metadata/dependencies/symlinks. Test stable policy hashes despite object-key order and `explain-config`-ready differences including deletion to defaults.
- [ ] **Step 5:** Run `node --test test/config.test.mjs`. Expected GREEN for defaults, the spec's JSON example, consumer-policy fixtures, and all invalid cases. Commit `feat: add repository quality policy resolution`.

### Task 3: Extract Git comparisons and isolated source snapshots

**Files:** Task-3 files in the map; reuse selected Chronote `quality-git`/helper assertions and Perkcord rename/deletion cases.

**Interfaces:** Produce `resolveComparison({ repo, base }) -> Comparison`, `loadPolicySelection({ repo, baselineSha, currentTree }) -> PolicySelection`, `listEligiblePaths(context, gate) -> string[]`, and `withSourceSnapshot(context, callback) -> Promise<T>`. Add `encodeScanContext(context) -> string` and `decodeScanContext(json) -> ScanContext` to `src/contracts.mjs`, preserving Map entries and validating comparison/policy identity. Reuse inherited diff/rename exports internally. All subprocess calls pass argument arrays with shell execution disabled.

- [ ] **Step 1:** Write failing real-Git fixture tests `local untracked copy is included without index mutation`, `tracked ignored source remains included`, `ignored scratch stays absent`, `non-JS duplication paths survive discovery`, `malicious diff header content cannot retarget a hunk`, and `explicit a/b prefixes override user diff settings`.
- [ ] **Step 2:** Run `node --test test/git.test.mjs`. Expected RED on source selection/comparison assertions.
- [ ] **Step 3:** Port the existing Git/diff/rename code. Enumerate cached plus nonignored untracked files with NUL delimiters, remove deleted paths, and reject symlinks. Separate per-scanner language filters. Snapshot exact selected source outside the consumer tree. Disable external diff/textconv and avoid hooks or inherited repository executable configuration in temporary Git operations.
- [ ] **Step 4:** Add tests proving explicit bases use merge-base locally; a prepared merge uses the actual target parent; absent `origin/HEAD` requires `--base`; spaces/Unicode/newlines survive path handling; module/declaration/generated eligibility and moves out of excluded scope behave correctly. Load active config from the baseline, proposed config from the current tree, and reject malformed proposed config. Changing thresholds, exclusions, or deleting the file must not change active policy.
- [ ] **Step 5:** Run `node --test test/git.test.mjs test/config.test.mjs`. Expected GREEN, unchanged caller file hashes/status/index tree/config, and cleaned temporary directories after errors. Commit `feat: isolate Git-relative quality comparisons`.

### Task 4: Combine both duplication implementations without losing coverage

**Files:** Task-4 files in the map; `test/fixtures/duplication/`; `docs/supported-formats.md`.

**Interfaces:** Produce `scanDuplication(context: ScanContext) -> Promise<GateReport>`. Preserve inherited normalized-endpoint, clone classification, range/rename, and shortened-clone functions with their existing signatures where tests rely on them. Add shared `runScannerEntry(name, scan) -> Promise<void>` in `src/scanners/entry.mjs`; it decodes stdin through task 3's helper and emits one report plus measured exit 0/1/2. All three scanner entrypoints use it.

- [ ] **Step 1:** Port both repositories' meaningful clone assertions, keeping pure normalization separate from real-engine fixtures. Add `configured format cannot silently disappear`, `Markdown layout is ignored but prose and fenced copies remain detectable`, and `Python or shell comment-only edit preserves old clone identity` as failing tests.
- [ ] **Step 2:** Run `node --test test/duplication.test.mjs test/duplication.integration.test.mjs`. Expected RED on missing scanner/normalization behavior.
- [ ] **Step 3:** Retain Perkcord's broader format and embedded-code normalization, then bring in Chronote's later snapshot eligibility, explicit Git prefix, disabled native gitignore, explicit scanner size limit, and report validation protections. Resolve jscpd relative to the installed tool root. Use one supported-format inventory obtained from the pinned engine and prove each advertised format with a real fixture; do not infer coverage from a normalization map alone.
- [ ] **Step 4:** Exercise `ADDED TWICE`, `DUPLICATES EXISTING`, same-file copies, rewritten endpoints, shortened clones, literal/regex distinctions, YAML scalar hashes, fenced JS/TS/shell, table separators versus literal code, large eligible files, and paths with spaces. Compare the three Perkcord reviewed-boundary cases as external migration evidence without embedding its boundary registry in shared runtime code.
- [ ] **Step 5:** Run the task-4 suites and inherited duplication suites. Expected GREEN with identical findings under equal scope/policy except explicitly documented correctness fixes. Run the scanner from a tool checkout against a separate fixture lacking application dependencies. Commit `feat: share multi-format duplication ratcheting`.

### Task 5: Extract complexity and file-size checks with per-path settings

**Files:** Task-5 files in the map; `test/fixtures/functions/` when shared AST fixtures reduce repetition.

**Interfaces:** Produce `scanComplexity(context) -> Promise<GateReport>` and `scanFileSize(context) -> Promise<GateReport>`, with the same stdin/report/exit convention as duplication. Complexity identity preserves Perkcord object ownership/accessors and Chronote lexical-owner/same-name-family fixes. File-size counting is shared with test-source reports.

- [ ] **Step 1:** Add failing assertions for new complexity 15 passing and 16 failing, either metric growing on an old offender, unchanged/shrinking offenders, inline lint-disable comments having no effect, and distinct Convex/object/class/nested function identities. Add file-size assertions for 999 to 1,000 failing, 1,250 to 1,220 passing, and 1,250 to 1,251 failing.
- [ ] **Step 2:** Run `node --test test/complexity.test.mjs test/file-size.test.mjs`. Expected RED on extraction or policy resolution.
- [ ] **Step 3:** Port measurements into script-owned noInlineConfig ESLint and physical-line modules. Resolve the effective check for each eligible current file. Measure baseline and current with the same thresholds; recognized renames use destination-path policy. Skip off scopes and retain advisory findings without dropping their identities or values.
- [ ] **Step 4:** Test overlapping package/test overrides, the example 1,500-line test cap, globally off checks enabled within a package, `.mts`/`.cts`, CRLF/terminal newlines, parser errors, renamed complex functions, getters/setters, anonymous callback caveats, and changing same-name family counts. Contradictory/malformed metric messages must fail operationally.
- [ ] **Step 5:** Run both suites with `test/config.test.mjs test/git.test.mjs`. Expected GREEN, no project ESLint/config imports, accurate override indices/reasons, and deliberate measurement-identity limits documented. Commit `feat: share configurable complexity and file-size checks`.

### Task 6: Implement reports, process validation, and local commands

**Files:** Task-6 files in the map; `test/helpers/process.mjs`; `docs/local-use.md`.

**Interfaces:** Produce `runQuality(context: RunContext) -> Promise<QualityReport>`, `validateQualityReport(report, context: RunContext) -> QualityReport`, `summarizeTestDebt(rows, inventory) -> object`, `collectTestSourceInventory(context: ScanContext) -> object`, and `main(argv: string[]) -> Promise<0 | 1 | 2>`. Public entrypoint is `node bin/quality-ratchet.mjs`.

- [ ] **Step 1:** Write failing runner tests with these asserted outcomes:

```js
assert.equal(
  combineResults([ratchetRegression, advisoryRegression, disabled], context)
    .strictExitCode,
  1,
);
assert.equal(
  combineResults([ratchetClean, advisoryRegression, disabled], context)
    .strictExitCode,
  0,
);
assert.equal(
  combineResults([ratchetClean, advisoryError, disabled], context)
    .strictExitCode,
  2,
);
assert.throws(() => validateQualityReport(missingScannerReport, context));
assert.throws(() => validateQualityReport(fakeDisabledWithoutPolicy, context));
```

Define `combineResults(results, context: RunContext) -> QualityReport` in `src/runner.mjs`; use fixture builders in the test helper, not hand-maintained partial production reports. Add failing test-debt count/order, oversized-test advisory, invalid-mode/exit, wrong-policy-hash, and empty-coverage assertions.

- [ ] **Step 2:** Run `node --test test/runner.test.mjs test/reports.test.mjs test/cli.test.mjs`. Expected RED for missing collection/validation/CLI behavior.
- [ ] **Step 3:** Run enabled scanners as child Node processes with validated JSON stdin and known source entrypoints. Collect every outcome despite a regression. Validate usable scanner-specific findings, baseline identity, counts/ranges, configured thresholds/modes, and completeness. Use the inherited 180-second external-scan ceiling and bounded output. Reuse full current duplication data for the enabled hosted test-debt view.
- [ ] **Step 4:** Implement the default strict check with `--repo`, `--base`, `--json`; diagnostic `report-test-debt` and `report-test-size` with `--repo`, `--json`; and `explain-config` with `--repo`, `--base`, `--json`. Unsupported flags fail with 2. On-demand reports honor active settings and explain when a requested report is disabled; they never fabricate a scan. Document a pinned separate local tool checkout and a one-line consumer command alias, without publishing a second npm product or copying scanner source.
- [ ] **Step 5:** Test all-advisory success with explicit zero blocking coverage, all-off/empty-scope failure, off-by-policy versus missing scanner, contradictory JSON/process outcomes, signals/timeouts, scanner errors in advisory mode, disabled report records, stable hotspot ordering, and warning-only absolute test sizes. Run the three task suites plus all previous suites, then commit `feat: validate quality outcomes and provide local commands`.

### Task 7: Implement the live GitHub adapter and pure exception policy

**Files:** Task-7 files in the map. Port Chronote's rationale parser and policy tests, adapting checker-test evidence to release-qualified installed-tool evidence rather than rerunning development tests in consumers.

**Interfaces:** Produce `readCurrentPr({ token, owner, repo, number }) -> Promise<CurrentPr>`, `preparePrComparison({ checkout, event, token, tempRoot }) -> Promise<{ context: RunContext, scanned: ScannedRevision, cleanup: function }>`, `evaluatePolicy({ report, scanned, current, toolVerified }) -> PolicyResult`, `writeEvidence({ report, scanned, current, result, directory }) -> { reportPath, evidencePath }`, and `renderSummary({ report, scanned, current, result }) -> string`. Inject a small GitHub client transport for deterministic race/error tests.

- [ ] **Step 1:** Write failing tests `comment-only rationale cannot waive regression`, `fenced heading is not a real section`, `Setext/indented section boundaries end the rationale`, `accepted exception retains findings`, `missing rationale fails even with clean scanners`, and `advisory errors remain unexemptable`. Reuse actual inherited parser assertions.
- [ ] **Step 2:** Run `node --test test/policy.test.mjs test/github-prepare.test.mjs test/github-summary.test.mjs`. Expected RED on adapter/freshness/summary behavior.
- [ ] **Step 3:** Prepare an isolated merge from the validated exact event head and freshly fetched target tip, keeping authentication temporary. Record head/base/tree/config/policy identities. Verify the prepared tracked tree around scanning. Before policy, re-read the actual PR and current target branch. Fetch/API failures become operational errors; stale head/base/ref results block with a rerun message.
- [ ] **Step 4:** Test malicious ref/body/path text as inert data, credential cleanup on fetch/merge/parser failure, all-advisory final outcome, label addition/removal and rationale edits across pushes, retarget/head/base races, exception on missing scanner, and HTML/Markdown escaping exactly once. Assert summaries contain measurements/locations and no source snippets or tokens.
- [ ] **Step 5:** Run the task-7 suites and all existing suites. Expected GREEN with no secret persistence, no source mutation, and live decision metadata matching the scanned revision. Commit `feat: enforce live PR quality exception policy`.

### Task 8: Package the composite action and consumer workflow

**Files:** Task-8 files in the map; `test/fixtures/hostile-consumer/`; tool manifest/version output in `src/cli.mjs`.

**Interfaces:** Root action inputs: `github-token` and `repository-path` defaulting to workspace. Outputs: `outcome`, `strict-exit-code`, `report-directory`. `run-action.mjs` writes available evidence and final result without prematurely skipping report upload; `finish-action.mjs` maps the saved final result to the step failure after upload.

- [ ] **Step 1:** Write failing action contract tests for all seven events, no path filter, read-only permissions, exact checkout/full history/no persisted credentials, PR concurrency cancellation, 20-minute timeout, exact job name, seven-day artifact retention, and output availability before final failure. Assert the example consumes only the two supported inputs.
- [ ] **Step 2:** Run `node --test test/action.test.mjs`. Expected RED on action/template/bootstrap behavior.
- [ ] **Step 3:** Implement composite steps that set up pinned Node 24, copy tool files from `github.action_path` into a unique runner-temporary tool directory, and run `npm ci --ignore-scripts --omit=dev` there. Invoke the GitHub adapter; upload available reports with an always-on-noncancelled condition; set outputs; finish with the saved verdict. Pin nested actions to exact reviewed SHAs, resolving actual refs during execution rather than inventing hashes in this plan.
- [ ] **Step 4:** Add real-process installation/isolation tests using a consumer with incompatible ESLint/TypeScript, a lifecycle script that writes a sentinel if run, custom `.npmrc`, and paths containing whitespace. Run installation from the tool temp directory with consumer npm configuration excluded. Assert no sentinel, no app dependency resolution, unchanged caller index/files/config, and cleanup after both success and failure. Required source/dependency/report directories must not be scanned as authored source.
- [ ] **Step 5:** Run action tests plus complete tool checks. Expected GREEN with report uploads reachable for failing scans, explicit unsupported-event failure, no `pull_request_target`, no inherited secrets, and an independently usable consumer workflow. Commit `feat: package the shared quality ratchet action`.

### Task 9: Qualify the first release with hosted evidence and fresh review

**Files:** Task-9 files in the map. Define package scripts `test`, `lint`, `format:check`, and `check` in the shared repo; `check` runs tool tests, lint, formatting, and schema/example validation.

**Interfaces:** Consume the finished root action and CLI. Produce a reviewed immutable release commit, exact consumer pin, release notes, and a sanitized acceptance record. Release workflow checks a candidate tag/ref; publishing remains an explicit execution step after results are acceptable.

- [ ] **Step 1:** Add Ubuntu/Windows Node 24 test jobs and a Linux action-package test with production-only dependencies. Run the candidate root action against its own PR using the already-staged self-check policy, plus `npm run check` and a clean `npm ci --ignore-scripts --omit=dev` smoke. Expected: all behavior tests pass with zero unexplained skips; scanner/parser/glob/schema versions and execution time are recorded.
- [ ] **Step 2:** Compare old and new checker outputs on isolated fixtures and read-only copies of both source snapshots with equivalent policies. Include web, bot, Convex object handlers, package code, tests, scripts, Markdown, shell, YAML, and Terraform. Explain differences caused by intentional correctness fixes; resolve unexplained gaps before release. Keep detailed private-consumer output in that consumer's permitted evidence location; the public shared acceptance record contains sanitized counts and behavior conclusions, not private source/report dumps.
- [ ] **Step 3:** Open an attached implementation PR in the shared repo and run hosted clean/regression/advisory/config-edit/failure cases. Use disposable, unmerged probe branches/PRs for exception transitions. Before any probe label writes, verify the human authorization covers these new probe identities; the old authorization for Chronote #416 does not carry to new PRs. Without that authorization, finish every non-label case and present the exact bounded probe request.
- [ ] **Step 4:** Verify label without rationale fails, label with rationale accepts only regressions, a later push keeps the exception, rationale removal fails, label removal restores blocking, and a missing scanner fails while exempt. Read the emitted JSON evidence as well as check colors. Close probes without merging and clean only task-owned temporary resources.
- [ ] **Step 5:** Obtain a fresh whole-branch review on the most capable available review model, focused on the fixed source head and the five Review Focus cases. Apply valid feedback with meaningful RED/GREEN cases, rerun appropriate checks, and audit configured PR feedback. Perform the required exact-head post-window readiness refresh before any merge-ready claim. Publish the reviewed release only after its source is integrated through the authorized repository path; record full release SHA and nested action pins.
- [ ] **Step 6:** Publish versioned release notes, supported-format inventory, configuration/schema documentation, local setup, caller requirements, and rollback instructions. Prefer full release SHA pins in examples, with a version comment. Enable GitHub Actions dependency-update PRs in consumers where allowed; do not promise automatic adoption or schedules not configured.

### Task 10: Stage explicit policies in Chronote and Perkcord

**Files:** Each consumer's `quality-ratchet.json` plus a short contributor-policy note. No scanner replacement or branch-rule removal yet.

**Interfaces:** Consume the initial reviewed tool release and per-repo source inventories. Produce valid policy files already merged on each consumer target branch before shared enforcement begins.

- [ ] **Step 1:** Refresh both default branches in isolated managed worktrees and read their current instructions. Generate a policy comparison showing existing thresholds, enforced test inclusion, supported formats, generated exclusions, and diagnostic reporting. Recheck current checks/branch rules and Perkcord's reviewed-boundary behavior; dated source snapshots are not current acceptance.
- [ ] **Step 2:** Prepare Chronote's configuration with all three ratchets, thresholds 15/15, 1,000 lines, and 8 lines/50 tokens, tests included, and duplication restricted to its existing JS/TS scope. Configure Perkcord with those enforced thresholds and its existing broader supported duplication scope and test advisories. Document any generated exclusions explicitly. Do not use the illustrative 1,500-line test override as a consumer policy decision.
- [ ] **Step 3:** Validate both files through the shared schema/`explain-config` and run fixture comparisons. Expected: proposed settings match existing enforced policies; no disabled/advisory mode or scope loss is silently introduced. Any desired policy change gets an explicit review note and agreement.
- [ ] **Step 4:** Open/attach separate configuration-preparation PRs while old gates remain active. Complete their normal checks and review/readiness requirements, including the 30-minute exact-head window. Present merge-ready results without assuming merge authorization. After authorized/user merges, read back the files from the target branches before continuing to tasks 11/12.
- [ ] **Step 5:** Record merged policy commits in the shared acceptance appendix. A migration can proceed independently once its own target policy is present; it need not wait for unrelated changes in the other repo.

### Task 11: Migrate Chronote to the shared release

**Files:** Modify `.github/workflows/code-quality.yml`, `package.json`, `yarn.lock`, `eslint.config.mjs`, `.github/pull_request_template.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `README.md`, `docs/engineering/code-quality.md`, and `docs/adr-20261016-code-quality-ratchets.md` as needed. Create `scripts/run-shared-quality.mjs` and `scripts/shared-quality.test.mjs`. Remove superseded scanner/helper/test files listed in the original Chronote implementation plan after usage checks. Preserve `.github/workflows/ci.yml`, `ci-core.yml`, and deployment checks except references that actually change.

**Interfaces:** Consume the released root action and staged target policy. Preserve `Code quality ratchet` as the observed required job context if GitHub emits it unchanged. Local `check:quality` invokes `node scripts/run-shared-quality.mjs`, which launches the pinned shared checkout's `bin/quality-ratchet.mjs --repo <consumer>`. Resolve it through `QUALITY_RATCHET_HOME`, a tool-location setting only. The launcher checks the checkout's HEAD equals the workflow's expected release SHA and tool source is clean, then uses `spawnSync(process.execPath, args)` with no shell. It contains no scanner, scope, threshold, or exception implementation. A consumer contract test keeps launcher and workflow pins equal.

- [ ] **Step 1:** Add or adapt meaningful workflow/local-wrapper contract tests showing the caller pins the exact release, uses the required events/permissions, and fails with a setup message when the pinned local tool is unavailable. Keep these consumer integration contracts; move engine tests centrally.
- [ ] **Step 2:** Run the focused contract tests before replacing the old wiring. Expected RED on the absent action call/local invocation contract.
- [ ] **Step 3:** Replace the workflow internals with checkout plus the root action. Replace local scanner aliases and update broad-check scripts to invoke the shared local tool. Remove scanner-only package dependencies after searching all consumers; retain dependencies used by unrelated lint/tests. Remove copied engine code/tests, but preserve integration tests for the consumer workflow and wrapper. Update docs and the ADR to explain the shared release, active policy, local setup, and unchanged exception contract.
- [ ] **Step 4:** Run focused integration tests, lint/format/Markdown, the shared strict tool against the migration, and applicable broad CI. Verify clean/regressed/exempt fixture behavior and available report artifacts with the staged target configuration. Preserve existing scc/Lizard diagnostics and deployment guards.
- [ ] **Step 5:** Open/attach the migration PR. Refresh check names and branch rules, preserving unrelated settings. Activate any replacement required context before removing a superseded requirement; if the existing context survives, avoid a settings write. Complete review and the 30-minute exact-head audit. After authorized/user merge, verify the shared action on the default branch and the effective required rule.

### Task 12: Migrate Perkcord with CI and local-hook parity

**Files:** Modify `.github/workflows/ci.yml`, create `.github/workflows/code-quality.yml`, `scripts/run-shared-quality.mjs`, and `scripts/shared-quality.test.mjs`, and update `package.json`, `package-lock.json`, `.husky/pre-commit` only if its invocation changes, `scripts/ci-lane-gate.mjs`/tests only where required, local pre-push/commit wrapper references, `AGENTS.md`, applicable contributor guidance, `docs/agentic/duplication-ratchet.md`, and `docs/agentic/complexity-and-size-ratchets.md`. Remove superseded `scripts/{dup-gate,dup-gate-boundaries,complexity-gate,file-size-gate,ratchet-common,ratchet-test-helpers,test-debt-report}*.mjs` only after checking remaining imports. Preserve unrelated test helpers and diagnostics.

**Interfaces:** Consume the same released action and Perkcord's staged target policy. Use task 11's thin-launcher contract, with no shared engine code copied. Keep `check:commit` running strict shared checks over tests. Retain existing `report:test-debt` and `check:test-size` names as thin invocations of shared diagnostic commands. The dedicated shared PR check owns exception policy; `format`/`application-ci` keep their unrelated responsibilities.

- [ ] **Step 1:** Add failing consumer contract tests for the pinned dedicated PR job, strict commit-hook path, shared report aliases, existing broad duplication scope, required-check behavior, and main-push handling after an accepted exception. Preserve the current `format` and `application-ci` integration assertions for all unrelated checks.
- [ ] **Step 2:** Run the focused Node/Vitest workflow/aggregate tests named by the current consumer manifest. Expected RED on the new integration assertions, without executing live payment/provider operations.
- [ ] **Step 3:** Replace ratchet execution inside `format` with the dedicated shared PR workflow. Remove its main-push strict delta rerun and engine-specific tests after their central equivalents pass. Keep Prettier and unrelated format-job tests. Configure the shared required check independently; do not make label/body edits restart application builds or deployment jobs. Preserve main-push `application-ci` and deployment prerequisites for their remaining checks. Adjust gate scripts/tests only if their job dependency model actually changes.
- [ ] **Step 4:** Keep `scripts/check-metrics.sh`, its selected source paths, exclusions, function-length limit, pinned Lizard, and scc job unchanged. Preserve its warning-exit behavior. Compare the three reviewed clone boundaries, ordinary old clones, and representative changed/moved/new-copy cases. Do not copy the boundary registry into the action or broadly exclude those files; resolve mismatches before removing the old duplication checker.
- [ ] **Step 5:** Run Perkcord's focused workflow/aggregate/hook tests, `npm run check:fast`, applicable broader CI, and shared-tool fixture comparisons. Verify diagnostic commands preserve counts/meaning and report successful generation without converting absolute debt totals into merge blockers. Prove an accepted exception will not fail a later main-push aggregate: use an isolated integration fixture or explicitly authorized disposable hosted target, with no production promotion.
- [ ] **Step 6:** Open/attach the migration PR; audit all checks/reviews/threads/sticky summaries and observed required contexts after the 30-minute exact-head window. Preserve active old enforcement until replacement readiness is proven. After authorized/user merge, verify shared workflow/policy on `main`, effective branch rules, and ordinary main CI. Report any retained compatibility gap rather than claiming migration complete.

### Task 13: Final review, acceptance record, and rollback handoff

**Files:** `docs/acceptance.md`, `docs/adoption.md`, and concise consumer migration notes. Avoid adding evidence-only commits after a final readiness window if they would reset it; reconcile final mutable state in the owning chat when appropriate.

**Interfaces:** Consume the tool release pin, both merged policy refs, both migration PRs/heads, and settings readbacks. Produce an evidence-backed account of what is released, adopted, required, and still outside shared scope.

- [ ] **Step 1:** Obtain a fresh review of both consumer migration diffs and their interaction with the released tool. Recheck policy resolution, required-check names, Perkcord aggregation/main-push behavior, local wrapper pin verification, and unchanged legacy metrics. Address valid findings in their owning repo; release a new shared version if the fix changes tool code.
- [ ] **Step 2:** Reconcile exact release/consumer heads with final hosted checks, feedback, branch-rule readbacks, and user-authorized merges. Every changed PR head needs its own renewed 30-minute readiness audit. Distinguish source tests, CI, publication, merge, required-rule activation, and runtime/deployment state.
- [ ] **Step 3:** Document rollback for each consumer as a reviewed revert to its prior workflow/dependencies/code and required context, while retaining unrelated branch rules. When only a shared release is defective and its predecessor is compatible, a reviewed pin rollback is sufficient. Preserve old required enforcement until the replacement rollback check is proven; do not delete rules to get a green merge.
- [ ] **Step 4:** Record which checks remain local, notably Perkcord's legacy metrics. Confirm no copied shared-engine implementation remains in either migrated repo. Close disposable probes, unlink/archive task-owned temporary worktrees only when safe, and leave the primary dirty checkouts untouched.
- [ ] **Step 5:** Present the shared repo/release and both migration PR links, summarize validation and remaining limits, and provide adoption instructions for other portfolio repos. Do not migrate additional repositories or schedule follow-up monitoring without a scoped request.

## Acceptance checklist

- [ ] One public shared implementation, locked dependencies, supported-format inventory, schema, local command, action, and release documentation exist.
- [ ] Both inherited regression sets and new configuration/isolation/report/adapter cases pass on the required platforms, with skips explained.
- [ ] Hosted clean, regressed, advisory, invalid-config, stale, exempt, and exempt-operational-failure cases are proven with parsed report evidence.
- [ ] Consumer PRs cannot change their own active thresholds/modes/scope through proposed configuration, deletion, caller inputs, or undocumented CLI flags.
- [ ] Chronote and Perkcord each have the intended target-branch policy, shared release pin, local invocations, terminal acceptable CI, and verified required check.
- [ ] Existing Perkcord diagnostic reports and commit coverage survive; reviewed clone boundaries are reconciled; legacy metrics remain enforced as before.
- [ ] Accepted PR exceptions survive pushes and do not fail post-merge CI or trigger production mutations during acceptance.
- [ ] Fresh reviews, full feedback audits, readiness windows, publication provenance, and per-repo rollback records are complete. Any unmerged/blocked adoption is named explicitly.

## Evidence appendix and execution references

- Approved spec commit: `3d983f03` on local design branch `codex/quality-ratchet-design`, before this plan's approval-status update.
- Chronote extraction snapshot: `53d5593904c0d220989506ae23e7fe39f21a0b37`, from [implementation PR #415](https://github.com/Chronote-gg/Chronote/pull/415).
- Perkcord inspected snapshot: `6f4e39fa1204c434ed52746e4975e3b439f2bb3b`. The approved spec links its source files and differences. Refresh before consumer changes.
- The maintained design and plan now live in this shared repository under `docs/superpowers/`. Consumer primary checkouts are not execution workspaces for migration edits.
- [Ajv schema support](https://ajv.js.org/json-schema.html) documents draft-07 support. Use one schema dialect and one runtime validator.
- [minimatch documentation](https://github.com/isaacs/minimatch) defines matcher options; the accepted policy grammar is deliberately the supported subset in task 2.
- During execution, read the applicable worktree, TDD, subagent-driven execution, verification, review, and each consumer's post-push/review-recycle instructions. This plan adds no automated approval or deployment bypass.

Approved for execution on 2026-10-17. Task completion requires its verification evidence; approval alone does not mark a task complete.
