# Source and dependency provenance

The initial project setup contains configuration, dependency metadata, notices, and the approved design and plan. It contains no extracted scanner source or tests. Later extraction must preserve each file's applicable notices and record any added upstream material here before publication.

## Publication basis

On 2026-10-17 the owner approved the implementation plan, public `BASIC-BIT/quality-ratchet` creation, and extraction of generic checker code and tests from Chronote and Perkcord. The approval covers this shared tool. Product-specific boundary registries, business paths, customer data, credentials, and private operational material stay in their source repositories.

Chronote's [package declaration](https://github.com/Chronote-gg/Chronote/blob/53d5593904c0d220989506ae23e7fe39f21a0b37/package.json) explicitly names `AGPL-3.0-or-later` and author `BASIC-BIT`. This repository retains that exact declaration. Its root `LICENSE` is a byte-for-byte copy of [Chronote's license](https://github.com/Chronote-gg/Chronote/blob/53d5593904c0d220989506ae23e7fe39f21a0b37/LICENSE). The stock AGPL v3 text alone does not establish the or-later permission.

Perkcord is private and has no root LICENSE at the inspected snapshot. The owner's explicit authorization establishes permission to publish the generic extraction; private read access alone would not. No private checker source has been published in this setup. Before publishing later extracted code, inspect each source and test for third-party notices or separate terms. Resolve any conflicting or missing per-file basis before publishing that file. Do not treat the project license as permission to relicense unrelated Perkcord code.

The approved documents originated in Chronote and are now maintained here. Their execution status reflects the user's 2026-10-17 approval and selection of subagent-driven execution. Chronote-specific supporting links point to immutable public source blobs. Source references into private Perkcord remain access-controlled references, not copied operational records.

## Immutable extraction inventory

Use these snapshots rather than whichever consumer head happens to be checked out. Consumers can continue changing independently.

### Chronote

Source: [Chronote-gg/Chronote at 53d5593904c0d220989506ae23e7fe39f21a0b37](https://github.com/Chronote-gg/Chronote/tree/53d5593904c0d220989506ae23e7fe39f21a0b37).

| Intended input                                                                                       | Purpose                                                             |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `scripts/quality-git.mjs`, `scripts/quality-git.test.mjs`                                            | Git comparison, paths, ranges and source discovery                  |
| `scripts/ratchet-common.mjs`, `scripts/ratchet-test-helpers.mjs`                                     | Shared scanner and test support                                     |
| `scripts/dup-gate.mjs`, `scripts/dup-gate.test.mjs`, `scripts/dup-gate.integration.test.mjs`         | Duplication identities, baseline behavior and regression tests      |
| `scripts/complexity-gate.mjs`, `scripts/complexity-gate.test.mjs`                                    | Complexity measurements and function identity tests                 |
| `scripts/file-size-gate.mjs`, `scripts/file-size-gate.test.mjs`                                      | Physical-line measurements and baseline tests                       |
| `scripts/check-quality.mjs`, `scripts/check-quality.test.mjs`                                        | Combined scanner verdict and report checks                          |
| `scripts/quality-policy.mjs`, `scripts/quality-policy.test.mjs`, `scripts/quality-workflow.test.mjs` | PR exception, workflow and failure controls                         |
| `package.json`, `yarn.lock`, `LICENSE`                                                               | Version and source-term evidence, not application dependency inputs |

### Perkcord

Source: [Perkcord/perkcord at 6f4e39fa1204c434ed52746e4975e3b439f2bb3b](https://github.com/Perkcord/perkcord/tree/6f4e39fa1204c434ed52746e4975e3b439f2bb3b).

| Intended input                                                      | Purpose                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `scripts/dup-gate.mjs`, `scripts/dup-gate.test.mjs`                 | Broader formats, language normalization and regression cases |
| `scripts/ratchet-common.mjs`, `scripts/ratchet-test-helpers.mjs`    | Shared scanner and test support                              |
| `scripts/complexity-gate.mjs`, `scripts/complexity-gate.test.mjs`   | Object-literal and handler function identity cases           |
| `scripts/file-size-gate.mjs`, `scripts/file-size-gate.test.mjs`     | Existing size semantics and tests                            |
| `scripts/test-debt-report.mjs`, `scripts/test-debt-report.test.mjs` | Absolute test-debt inventory and test-size advisory          |
| `package.json`, `package-lock.json`                                 | Version evidence, not application dependency inputs          |

`dup-gate-boundaries.mjs` and its product-specific fixtures are migration comparison evidence only. The shared runtime receives no approved-boundary registry or fingerprint allowance data. Inherited tests must retain generic behavior cases while leaving business paths and product data behind. Consumer CI, hooks, deployment code and legacy metrics remain consumer-owned.

## Exact direct dependencies

These packages are runtime dependencies because the installed checker needs them while the consuming application has no dependencies installed. npm's lockfile records all transitive versions, integrity values, and supported native jscpd packages. Runtime resolution must start at the tool installation.

| Package                    | Version   | Installed license declaration | Reason                                               |
| -------------------------- | --------- | ----------------------------- | ---------------------------------------------------- |
| `eslint`                   | `10.12.0` | MIT                           | Chronote's inspected scanner engine                  |
| `typescript-eslint`        | `8.71.1`  | MIT                           | Chronote's parser/plugin family                      |
| `typescript`               | `6.0.3`   | Apache-2.0                    | Chronote's compiler/parser version                   |
| `eslint-plugin-sonarjs`    | `4.2.0`   | LGPL-3.0-only                 | Existing cognitive-complexity engine                 |
| `jscpd`                    | `5.0.12`  | MIT                           | Existing native duplication CLI                      |
| `@jscpd/tokenizer`         | `4.2.5`   | MIT                           | Existing tokenizer and format inventory              |
| `mdast-util-from-markdown` | `2.0.3`   | MIT                           | Perkcord Markdown normalization                      |
| `sh-syntax`                | `0.6.0`   | MIT                           | Perkcord shell normalization and bundled WASM parser |
| `minimatch`                | `10.2.6`  | BlueOak-1.0.0                 | Explicitly pinned policy glob matcher                |
| `ajv`                      | `8.20.0`  | MIT                           | Draft-07 configuration validation                    |

`prettier@3.9.10` is an exact development-only dependency, matching the inspected Chronote formatter version. The Node test runner needs no package. ESLint is a runtime scanner even if it also checks this tool's source. No application package, lifecycle hook, compiler build, or postinstall step supplies a scanner asset.

Dependency authors retain their licenses and notices in their installed packages. Keep those files when packaging or redistributing dependencies. In particular, the SonarJS LGPL declaration is independent of this project's AGPL declaration, and `sh-syntax/vendors/wasm_exec.cjs` retains its upstream notice. This setup distributes a lockfile rather than vendored dependency code.

### Ajv choice

Ajv `8.20.0` was reviewed on 2026-10-17 against the [upstream release notes](https://github.com/ajv-validator/ajv/releases/tag/v8.20.0), registry metadata and [schema documentation](https://ajv.js.org/json-schema.html). The release includes Node 22/24 support. The default export supports draft-07. An isolated runtime check compiled an explicit draft-07 schema, accepted a valid object and rejected an invalid one. No later schema dialect is needed.

### Install and runtime verification

Supported runtime: Node `>=24.15.0 <25`, with `.nvmrc` selecting `24.15.0`. Initial verification used Windows, Node `24.18.0` and npm `11.16.0`. The exact minimum Node version and Linux runtime still need acceptance in later tasks.

The initial lockfile was generated with `npm install --package-lock-only --ignore-scripts`. A temporary directory initially containing only `package.json` and `package-lock.json` passed `npm ci --ignore-scripts --omit=dev`. Every importable runtime package resolved inside that directory's own `node_modules`; the development formatter was absent. Ajv draft-07 and shell valid/invalid parse assertions passed. The shell check loaded the bundled `main.wasm` without lifecycle scripts. `jscpd@5.0.12` intentionally has no package-root module, so its shipped `run-jscpd.js --version` was executed and returned `cpd 5.0.12`. Its native binary is supplied by an optional platform package, so runtime installations must retain supported optional dependencies.

The full development installation was then restored with `npm ci --ignore-scripts`. Both installs reported zero known audit vulnerabilities at that time. This is installation evidence, not proof of the later scanners, action, release, or consumer migrations.

## Git/source extraction, Task 3

`src/git/diff.mjs` adapts the diff-path decoder, unified hunk parser, rename-status parser and overlap helpers from Chronote's `scripts/quality-git.mjs` at the immutable Chronote snapshot above. The inspected source has no separate file-level notice. The root license and NOTICE continue to apply. The inherited JS-only discovery and unsafe consumer-filter-aware blob hashing were replaced with independent policy selection and raw isolated Git objects.

`test/git.test.mjs` adapts generic parser, prefix, rename, deletion-boundary and source-eligibility assertions from Chronote's `scripts/quality-git.test.mjs` and generic rename/deletion cases in Perkcord's `scripts/dup-gate.test.mjs`, at the immutable snapshots above. Neither inspected test has a separate file-level notice or conflicting terms. The owner's recorded authorization covers this generic extraction. No product boundary registry, private business path, provider data, customer data or operational record was copied.

The remaining Task 3 modules and fixture helpers are newly written shared implementation. They run no consumer lifecycle command, hook, clean filter, external diff or text conversion. Consumer Git reads remain read-only; raw blob/index writes occur only in a temporary repository outside the consumer tree. The extraction has been committed locally for review. This note does not claim public publication or completed platform qualification.

## Duplication extraction, Task 4

`src/duplication/{normalize,shell,markdown,identity,baseline}.mjs` adapts generic normalization, exact endpoint identity, classification and baseline matching from Perkcord's `scripts/dup-gate.mjs` at the immutable snapshot above. `scanner.mjs` combines that identity logic with Chronote's later explicit scanner configuration, disabled native Git-ignore behavior, size ceiling and duplicate-array validation. Shared Task 3 snapshots own all source discovery, raw bytes and comparison metadata. Neither inherited Git implementation nor the product boundary registry is copied into the runtime.

The generic tests in `test/duplication*.test.mjs` and deliberate bodies in `test/fixtures/duplication/bodies.mjs` adapt both repositories' immutable duplication suites and fixture bodies. The inspected duplication modules, tests, `ratchet-common.mjs` and `ratchet-test-helpers.mjs` contain no separate file-level notices or conflicting terms. Their extraction uses the owner's recorded authorization and retains this repository's LICENSE and NOTICE. The approved private boundary data and source remain external migration evidence only. Shared tests contain no product boundary fixture, business path or operational record.

`src/duplication/formats.mjs` contains format metadata derived from jscpd's MIT-licensed `rust/crates/cpd-tokenizer/src/formats.rs` at upstream commit `64258a9af460fc554c1ad884f976787378721d90`, tag `v5.0.12`. `suppression.mjs` follows the pinned native textual suppression matching in `javascript.rs`, `generic.rs` and `markdown.rs` so source directives cannot waive a check. The full upstream MIT notice is appended to NOTICE. No native binary, library source or build tool is vendored. The scanner still runs the lockfile-installed native package through `run-jscpd.js`.

Task 4 intentionally refines the provisional 224-name configuration inventory to 132 routeable formats. All 130 effective native extension formats remain, including Razor, plus two explicit filename formats. MDX maps to Markdown. Native accepted names remain a separate 224-name inventory for embedded identities. Six native shebang languages also retain discovery. The supported-formats document distinguishes path detection, actual native fixture evidence and normalization limits. The pinned registry assigns `.vb` to `vbnet` (lines 729-730); `visual-basic` has no extension (lines 754-755). An independent empty-config native CLI regression confirms the emitted `vbnet` identity; the earlier task-report claim of a `visual-basic` last-owner route was incorrect.

This extraction does not claim complete Markdown prose coverage, Linux acceptance, a current exact match for every private reviewed boundary, public publication or consumer cutover. Those limits are stated in the task report and supported-formats document.

## Complexity and file-size extraction, Task 5

`src/complexity/identity.mjs` adapts function recording, lexical-owner names, object and Convex-shaped ownership, accessor names, same-name families, rule-message joining, candidate selection and debt comparison from Chronote's `scripts/complexity-gate.mjs` at the immutable snapshot above. Chronote already includes Perkcord's generic object/accessor handling and adds lexical-owner and changing-family safeguards. The corresponding immutable Perkcord implementation and tests were inspected to retain those cases. Static assignment targets retain names; dynamic computed targets use anonymous ordinal identities so expressions cannot appear in reports.

`src/scanners/file-size.mjs` adapts `physicalLines` and `classify` from Chronote's immutable `scripts/file-size-gate.mjs`. The same physical-line semantics were checked against Perkcord's corresponding gate and tests. Its reusable `physicalLines(text)` export supports the later test-size reports without a second counting implementation. Scanner orchestration is new shared code built on the existing config, Git snapshot and subprocess entry contracts.

`test/complexity.test.mjs`, `test/file-size.test.mjs` and `test/fixtures/functions/bodies.mjs` adapt generic measurement and identity assertions and synthetic bodies from both repositories' immutable gate tests. Tests for effective thresholds, overlapping overrides, advisory/off selection, dependency isolation, source-free identities, metric validation and destination-policy renames cover the shared integration. The inspected complexity/size gates, tests, `ratchet-common.mjs` and `ratchet-test-helpers.mjs` have no separate file-level notices or conflicting terms. This extraction uses the owner's recorded generic-source authorization and preserves LICENSE and NOTICE. No new license grant is inferred and no product registry, private business path, source fixture or operational record is copied.

Both measurements retain the eight approved JS/TS extensions. Inline ESLint configuration is disabled, consumer configuration is not loaded, and parser/plugins resolve only within the installed tool's `node_modules`. A recognized authored rename can retain its baseline despite an old per-check mode/scope exclusion; both source paths must have a supported JS/TS extension, and hard, generated and global source exclusions still prevent that reuse. Defaults remain cyclomatic/cognitive 15 and strictly fewer than 1,000 physical lines for new files. Non-growing existing debt passes. When an over-threshold function grows on either metric, or an oversized file grows, its finding includes the effective policy metadata.

Complexity matching remains a syntactic identity, not a proof that functions are semantically equivalent. Anonymous callbacks, dynamic computed targets and unnamed owners use source-order fallback; reordering can change their match. Same-name family-count changes classify touched over-threshold members as new. Class static blocks and non-function field initializers are outside the inherited function inventory; module-level messages for them are validated before being left unmatched. These deliberate limits remain visible in scanner coverage and the task report. The extraction is committed locally for review, without a public push, release or consumer cutover claim.

## Runner and diagnostic extraction, Task 6

`src/report.mjs` and `src/runner.mjs` adapt generic result validation and process collection from Chronote's `scripts/check-quality.mjs` at the immutable snapshot above. They retain scanner-specific measurements and measured exits, and add the shared active-policy, coverage, disabled-state and diagnostic contracts. `test/runner.test.mjs` adapts generic malformed-result and combined-outcome cases from its corresponding test file. Its fixtures first produce valid reports with the actual scanners, then mutate fields to test validation.

`src/reports/{scope,test-size,test-debt}.mjs` adapt test/support classification, physical-size inventory, pair counts and hotspot ordering from Perkcord's immutable `scripts/test-debt-report.mjs`, its tests, and the generic `isTestPath` pattern in `scripts/dup-gate.mjs`. The shared report imports the existing physical-line counter rather than adding another. Product-specific example paths were replaced with generic fixtures. The inspected runner, report, helper and test inputs have no separate file-level notices or conflicting terms. The recorded owner authorization covers this generic extraction; it does not relicense unrelated Perkcord material.

The CLI, explicit report inventory selection and policy-aware validation are new shared code. Enabled views preserve their corresponding active scanner scopes even when check mode is off. Full current duplication rows are reused, with no second diagnostic clone scan. Reports reject unrecognized fields and retain only paths, identities, measurements and known operational errors. Scanner stderr and normalized source strings are not included. The repository's LICENSE remains unchanged and NOTICE records this extraction. No consumer checkout, product registry, private business source or operational data was modified or copied.
