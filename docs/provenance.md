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
