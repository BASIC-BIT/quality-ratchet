# Release 1.0.0, qualified runtime

Version 1.0.0 uses policy and report schema version 1. It introduces the shared CLI and ordinary pull-request action with baseline-owned policy, three configurable checks and informational test reports.

The selected runtime is `ba9c9bec7c312a303e61b6779591610cd32509b8`. Hosted qualification and the fresh whole-branch review are complete, including the sole annotation correction and its scoped review. The adoption example pins this runtime. Publication has not happened. Source must integrate through PR #1 with a normal merge that preserves this commit before the coordinator creates the v1.0.0 tag and release at this commit. The documentation follow-up is not the release target.

See the [acceptance record](acceptance.md) for exact runs, versions and limits. Consumer configuration and activation remain separate work.

## Behavior to review

The shared tool retains Git-relative growth rules, tests in enforced scope, lexical complexity identities and 132 routeable duplication formats. It preserves embedded-language detections and reports prose-only Markdown omissions. Source suppression markers fail operationally. Unsupported normalization grammars use conservative raw identities, which can produce additional findings after whitespace or comment changes.

Compared with copied consumer scripts, policy now lives in one validated JSON file. Strict exits are 0, 1 and 2. Advisory findings remain visible; operational errors still block. Proposed policy cannot relax its own PR. There is no source allowance registry or warning-only strict flag. Consumer-specific scopes, hook wiring and already-reviewed boundaries need separate migration evidence.

## Qualification and publication

For v1.0.0, Ubuntu and Windows each passed 217 tests with no failures or skips on Node 24.15.0 and 24.21.0. The Linux production-only package smoke passed. Own-PR and cross-owner execution, policy edits, advisory and operational-failure cases, freshness checks, annotations and all authorized exception transitions passed inspection of actual reports and outputs. Both disposable probes are closed without merging. Immutable source comparisons match; current consumer migration acceptance remains separate.

The remaining publication steps are:

1. Push the docs/test follow-up, inspect its CI and feedback, and complete the exact-head readiness refresh after the latest pushed commit is at least 30 minutes old.
2. Integrate through PR #1 with a normal merge preserving runtime `ba9c9bec7c312a303e61b6779591610cd32509b8` in history. Do not squash away the selected release target.
3. Confirm every trusted runtime asset is unchanged in the documentation follow-up and run `node scripts/validate-examples.mjs --release` on the final main-branch documentation.
4. Explicitly publish the v1.0.0 tag and release at the selected runtime commit. A later runtime change requires renewed qualification and a new selection.
5. Prepare and review each consumer's policy and cutover under its existing gates before enabling the shared action.

The manual `Release check` workflow accepts a candidate ref and prints its resolved commit and tool manifest. Use a full SHA for reproducible qualification; a tag is resolved independently by each job and their recorded SHAs must agree. It runs checks and the package smoke only, has read-only permissions, and neither publishes nor substitutes for PR, exception or independent review evidence.

## Pins and maintenance

The manifest hashes raw runtime asset bytes and verifies the isolated copy against its source on the same machine. Checkout line-ending conversion can change that hash for one Git commit. This repository declares LF text checkout to keep its assets consistent; retain the observed platform manifest with each qualification record. Use the full Git SHA as the portable release identity, not a universal raw-byte hash.

The adoption template pins the selected full release SHA with a `# v1.0.0` comment. A convenience major tag may exist; consumers should use immutable pins. For future upgrades, restore the previous compatible reviewed pin to roll back. The initial release has no predecessor; preserve the consumer's old enforcement and follow the reviewed cutover-revert procedure in [adoption](adoption.md).

Current reviewed nested pins:

| Action                  | Version | Full SHA                                   |
| ----------------------- | ------- | ------------------------------------------ |
| actions/checkout        | v7.0.1  | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node      | v7.1.0  | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/upload-artifact | v7.0.2  | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Dependabot checks this repository's GitHub Actions weekly. Consumers must configure their own update PRs where permitted; this repository does not schedule their upgrades.

Changes to shared default thresholds/exclusions, existing configuration semantics, report schema or accepted inputs require a major version. Scanner updates and correctness fixes can change findings even in patch releases, so release notes must explain them. Repository-local policy edits do not require a shared release. Preserve provenance and notices on every release.

## Runtime identity

| Field              | Qualified value                                                    |
| ------------------ | ------------------------------------------------------------------ |
| Release target     | `ba9c9bec7c312a303e61b6779591610cd32509b8`                         |
| Version / schema   | 1.0.0 / 1                                                          |
| Runtime asset hash | `48a19355e78793cdc495987512c93b4cff580fd42142780b760e9e7a08c470dc` |
| Lock hash          | `f7401eb223be14df24b406248c918248074476d6be0bb6372fe8bb6b496e9953` |

The final correction publishes safe oversized-test warnings across bootstrap without changing scanner selection, fingerprints, policy, report validation or locked dependencies. GitHub displays at most 10 warning annotations per step; full inventories remain in JSON, summaries and logs. See [configuration](configuration.md#reports-and-errors) for that platform limit.
