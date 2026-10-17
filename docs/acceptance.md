# Initial release acceptance

Runtime `ba9c9bec7c312a303e61b6779591610cd32509b8` is qualified and selected for v1.0.0, schema 1. Hosted tests, action probes and review are complete. Publication remains pending source integration and an explicit tag/release at this runtime commit. The documentation follow-up pins this commit and does not introduce a new qualified runtime.

Chronote and Perkcord remain unmigrated, with no policies staged. The unresolved Perkcord runtime boundary must be reconciled before removing legacy allowance code.

## Final runtime qualification

[CI run 39075132754](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075132754) passed on the selected runtime. Each platform ran 217 tests with no failures or skips, followed by lint, formatting and schema/example validation.

| Platform | Node    | Test duration |
| -------- | ------- | ------------: |
| Ubuntu   | 24.15.0 |      53.081 s |
| Ubuntu   | 24.21.0 |      42.449 s |
| Windows  | 24.15.0 |     497.681 s |
| Windows  | 24.21.0 |     300.929 s |

The Linux production-only package smoke passed in 9.500 seconds. All four platform manifests matched runtime asset `48a19355e78793cdc495987512c93b4cff580fd42142780b760e9e7a08c470dc` and lock `f7401eb223be14df24b406248c918248074476d6be0bb6372fe8bb6b496e9953`. The own-PR action was clean against the actual main target, with all three scanners clean and 88 eligible files.

A fresh whole-branch review found one annotation-publication gap. The selected runtime fixes it, passed the full matrix, and received a clear scoped review. Scanner/configuration/identity/selection/report-validator/lock assets were unchanged by that correction.

## Hosted action evidence

Actual JSON, outputs and artifacts were inspected for these cases. Reports identify the installed runtime, source and target identities, active policy and strict/final verdicts. Controlled missing-scanner cases use deliberate faulty derivatives and are never release targets.

| Case                           | Run                                                                                                                                                                        | Observed result                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Clean, optional reports off    | [39075302496](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075302496)                                                                                       | Clean, strict 0                                                       |
| New regression                 | [39075394097](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075394097)                                                                                       | Regression, strict 1; finding retained                                |
| Proposed disable / deletion    | [39075501622](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075501622), [39075568848](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075568848) | Target policy retained; regression, strict 1                          |
| Invalid proposed policy        | [39075641087](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075641087)                                                                                       | Operational error, strict 2                                           |
| All-advisory                   | [39075732119](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075732119)                                                                                       | Advisory, strict 0; finding retained                                  |
| Missing scanner under advisory | [39075833902](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075833902)                                                                                       | Operational error, strict 2                                           |
| Cross-owner execution          | [39075196541, attempt 1](https://github.com/Chronote-gg/Chronote/actions/runs/39075196541/attempts/1)                                                                      | Clean, strict 0; outputs available and caller unchanged               |
| Target advanced during scan    | [39076028132](https://github.com/Chronote-gg/Chronote/actions/runs/39076028132)                                                                                            | Stale final verdict despite strict 0; scanned/live target SHAs differ |
| Safe oversized-test warning    | [39075166786](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075166786)                                                                                       | Exact comma/percent path retained, non-failing annotation             |

Cross-owner execution used shared defaults on a disposable target without a declared consumer policy. It proves resolution and execution, not migration acceptance. The caller's source, index and Git configuration remained unchanged.

The cross-owner report contained 15 oversized-test entries and emitted 15 safe warnings. GitHub retained 10 warning annotations, its [per-step display limit](https://docs.github.com/en/rest/checks/runs#update-a-check-run). All 15 entries remained in JSON, the summary and logs. This limit does not alter blocking findings or reports.

## Authorized exception transitions

The human authorized label and rationale changes only on the disposable shared probe. The approved rationale was "Intentional regression in a disposable qualification fixture; this PR will be closed without merging."

| Transition                          | Run                                                                                  | Final / strict result               |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| Label without rationale             | [39075977110](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39075977110) | Invalid exception 1 / 1             |
| Exact rationale added               | [39076042367](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39076042367) | Exception 0 / 1                     |
| Source push with exception retained | [39076120788](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39076120788) | Exception 0 / 1                     |
| Rationale removed                   | [39076204265](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39076204265) | Invalid exception 1 / 1             |
| Scanner failure while exempt        | [39076315542](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39076315542) | Operational error 2 / 2             |
| Normal runtime restored             | [39076413078](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39076413078) | Exception 0 / 1                     |
| Label removed, rationale retained   | [39076481829](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39076481829) | Regression 1 / 1, no current labels |

Findings and strict measurements remained in the reports. Shared PR #2 closed without merging at 2026-10-17T22:49:39Z, with no labels. Cross-owner PR #418 also closed without merging. No consumer policy, deployment or migration was activated.

## Compatibility evidence

Earlier extraction checks compared legacy and shared native duplication under equal thresholds. Prose-only Markdown produced zero rows on both; adding qualifying fenced code produced two rows on both, including one prose row. This limitation remains explicit in coverage.

Three previously reviewed external clone-boundary records were compared without publishing their source, paths or fingerprints. Both infrastructure records matched exactly. Their unchanged/moved counts were zero in both tools; added-copy counts were three and edited-span counts were one. The runtime record matched neither tool's current native rows at the immutable snapshot. Its unchanged/moved counts were zero and its added-copy count was one, but exact reviewed-boundary acceptance remains UNKNOWN. Migration must refresh and reconcile that record before removing old allowance code.

The inherited suites retain lexical normalization, YAML scalar hashes, shell comments/heredocs, Python comments, Markdown layout/fences, rename and hunk translation, and complexity identities for web, bot and object-handler shapes. Deliberate differences include operational rejection of suppressible source, raw identities for unsupported grammars, conservative anonymous/same-name ownership, full current scans for diagnostics and removal of strict warning-only switches.

Task 9 ran immutable source comparisons on Windows Node 24.18.0 using the same installed scanner versions, 8-line/50-token duplication thresholds and equal selected source bytes. The first source uses its existing JS/TS scope; the second uses its existing generated/dependency exclusions and shared routeable formats. Tests are included. This is immutable-snapshot evidence, not current-live migration acceptance.

| Comparison        | Selected source files | Legacy/shared duplicate rows | Endpoint, measurement or identity differences | Unchanged findings |
| ----------------- | --------------------: | ---------------------------: | --------------------------------------------: | -----------------: |
| Chronote snapshot |                  1142 |                    611 / 611 |                                             0 |              0 / 0 |
| Perkcord snapshot |                  1882 |                    482 / 482 |                                             0 |              0 / 0 |

Changed fixtures cover web, bot, Convex object handlers, package code, tests and scripts for both checkers. The broader checker also covers Markdown, shell, YAML and Terraform. Added-copy findings matched exactly at 6/6 and 10/10 respectively. Complexity findings and current/baseline measurements matched at 6/6 in each comparison; new 1,000-line test-file findings matched at 1/1. Exact comparable finding sets were asserted, not just their counts.

Read-only Git object access supplied source bytes. Source indexes and Git configuration hashes stayed unchanged. Legacy modules and source copies existed only in temporary external directories and were removed. Detailed private endpoint evidence remains in the permitted private consumer evidence store.

The first candidate's hosted run exposed failures that supersede its earlier local acceptance. Ubuntu checks and the Linux production smoke passed, but Windows root-path spelling and checkout line endings broke tests. The own-PR action also found seven duplication and seven complexity regressions against the actual main target. Earlier per-task comparisons had not covered that whole-branch baseline.

The correction canonicalizes both repository identities through the filesystem, preserves workspace containment checks, and gives this repository an LF checkout policy. Focused tests cover real aliases, case variants, subdirectory rejection and outside-workspace rejection. Small refactors remove the reported duplication and complexity without changing policy or thresholds. A 1,320-case schema comparison preserved acceptance and rejection behavior.

The corrected local suite passed 214/214 with no skips in 77.392 seconds, followed by lint, formatting and schema/example validation. The actual self-policy against the main target reported zero findings in all three scanners. Immutable source and changed-fixture comparisons were repeated after the runtime refactors. This intermediate result was superseded by the final runtime qualification above. The final annotation correction left scanner and comparison assets unchanged, so the exact source-parity results still apply to the selected runtime.

The immutable JS/TS suppression-marker path check performed during coordination found no marker-bearing files in either source snapshot. This does not prove current-source acceptance. The documented suppression behavior, native container coverage and conservative identities remain covered by the existing real scanner suites. Current-source migration and hosted checks remain separate acceptance work.

## Remaining publication and migration work

The coordinator must push the docs/test follow-up, inspect exact-head checks and feedback after the required 30-minute window, and integrate PR #1 with a normal merge preserving the selected runtime. The v1.0.0 tag and release must point to that runtime commit, not the documentation follow-up. The current example and local setup already use its full SHA; release validation must pass on the final main-branch documentation.

Consumer acceptance still requires current source/policy comparison, reviewed-boundary reconciliation, target-policy preparation, hooks and aggregate CI wiring, actual required-check settings and main-push behavior after an accepted exception. Publication alone does not complete consumer migration. See [adoption](adoption.md) for preparation and rollback.
