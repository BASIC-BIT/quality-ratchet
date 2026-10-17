# Release 1.0.0 candidate

Version 1.0.0 uses policy and report schema version 1. It introduces the shared CLI and ordinary pull-request action with baseline-owned policy, three configurable checks and informational test reports.

This is an unpublished candidate. Hosted platform results, fresh whole-branch review, the final runtime commit and the adoption pin remain pending. Do not publish a tag or adopt the example while `REPLACE_WITH_FULL_RELEASE_SHA` remains.

## Behavior to review

The shared tool retains Git-relative growth rules, tests in enforced scope, lexical complexity identities and 132 routeable duplication formats. It preserves embedded-language detections and reports prose-only Markdown omissions. Source suppression markers fail operationally. Unsupported normalization grammars use conservative raw identities, which can produce additional findings after whitespace or comment changes.

Compared with copied consumer scripts, policy now lives in one validated JSON file. Strict exits are 0, 1 and 2. Advisory findings remain visible; operational errors still block. Proposed policy cannot relax its own PR. There is no source allowance registry or warning-only strict flag. Consumer-specific scopes, hook wiring and already-reviewed boundaries need separate migration evidence.

## Qualification and publication

1. Run CI on the exact candidate head. Ubuntu and Windows each test exact minimum Node 24.15.0 and current Node 24. The Linux production-only package job verifies the installed assets and scanner entrypoints.
2. Run the candidate root action against its own ordinary PR with the self-policy already present on its target. Read JSON evidence, summary, outputs and uploaded artifacts for clean, regression, advisory, configuration-edit and failure cases.
3. Use disposable unmerged PRs for exception transitions. Obtain explicit human authorization for their exact identities before label writes. Exercise no-rationale failure, accepted regressions, persistence after push, rationale removal, label removal and scanner failure while exempt.
4. Compare legacy and shared behavior under equivalent policies. Retain consumer gates until source scopes, unchanged debt, changed fixtures and reviewed boundaries are reconciled.
5. Obtain a fresh whole-branch review of the fixed source head and resolve valid feedback. After the latest pushed commit is at least 30 minutes old, refresh every check, review, comment, thread, mutable review summary and mergeability state.
6. Integrate through the authorized repository path. Select the last reviewed runtime-code commit after qualification. Record its full SHA and trusted asset hash. Update the adoption example and version notes in a docs/test-only follow-up without changing those runtime assets. Requalify if runtime assets change.
7. Run `node scripts/validate-examples.mjs --release` on the finalized main-branch documentation. It rejects a pending pin. Confirm the example resolves to the selected release and publication rights are complete. Only then explicitly publish the version tag and release notes.

The manual `Release check` workflow accepts a candidate ref and prints its resolved commit and tool manifest. Use a full SHA for reproducible qualification; a tag is resolved independently by each job and their recorded SHAs must agree. It runs checks and the package smoke only, has read-only permissions, and neither publishes nor substitutes for PR, exception or independent review evidence.

## Pins and maintenance

The manifest hashes raw runtime asset bytes and verifies the isolated copy against its source on the same machine. Checkout line-ending conversion can change that hash for one Git commit. This repository declares LF text checkout to keep its assets consistent; retain the observed platform manifest with each qualification record. Use the full Git SHA as the portable release identity, not a universal raw-byte hash.

The final adoption template must pin the selected full release SHA with a `# v1.0.0` comment. A convenience major tag may exist; consumers should use immutable pins. Restore the previous reviewed pin to roll back. Keep old enforcement until migration acceptance makes rollback practical.

Current reviewed nested pins:

| Action                  | Version | Full SHA                                   |
| ----------------------- | ------- | ------------------------------------------ |
| actions/checkout        | v7.0.1  | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node      | v7.1.0  | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/upload-artifact | v7.0.2  | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Dependabot checks this repository's GitHub Actions weekly. Consumers must configure their own update PRs where permitted; this repository does not schedule their upgrades.

Changes to shared default thresholds/exclusions, existing configuration semantics, report schema or accepted inputs require a major version. Scanner updates and correctness fixes can change findings even in patch releases, so release notes must explain them. Repository-local policy edits do not require a shared release. Preserve provenance and notices on every release.
