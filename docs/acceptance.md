# Initial release qualification, October 18, 2026

As of this snapshot, runtime `9d713408d8c12eb9ced26fe45b4a99e1df5505ff` is qualified and selected for v1.0.0, schema 1. Corrected hosted tests, action probes and scoped review are complete. Publication remains pending source integration and an explicit tag/release at this runtime commit. The documentation follow-up pins this commit and does not change trusted runtime assets. Check the [v1.0.0 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.0) for publication status.

The earlier `ba9c9bec7c312a303e61b6779591610cd32509b8` candidate was withdrawn before publication after configured review found source-path and warning-transport defects. The runs below all qualify the corrected runtime, except deliberately faulty missing-scanner derivatives identified as such.

Both consumers have explicit policy-preparation PRs under review, with existing gates retained. Neither policy has merged and neither consumer has activated the shared tool. Current-source duplication-boundary comparison is reconciled. Perkcord still needs resolution of, or explicit agreement to, one authored-declaration scope gap before migration or legacy duplication removal.

## Corrected runtime qualification

[CI run 39164339027](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39164339027) passed all six jobs on the selected runtime. Each platform ran 223 tests with no failures or reported skips, followed by lint, formatting and schema/example validation.

| Platform | Node    | Test duration |
| -------- | ------- | ------------: |
| Ubuntu   | 24.15.0 |      67.913 s |
| Ubuntu   | 24.21.0 |      66.913 s |
| Windows  | 24.15.0 |     387.772 s |
| Windows  | 24.21.0 |     476.229 s |

The real POSIX working-file literal-backslash test executes on Ubuntu. Its body returns early on Windows, so the reported zero skipped tests does not imply Windows exercised that POSIX fixture. The real 23,000-warning bootstrap test passed in all four jobs with one parent warning publisher and no child-buffer overflow.

The Linux production-only package smoke passed in 5.136 seconds; the serial local production-only smoke passed in 17.058 seconds. All four platform manifests matched runtime asset `01aca099cfa27459b5a6c25d39f386aecd68a0e9dcbe21f0e93041c7da7a8168` and lock `f7401eb223be14df24b406248c918248074476d6be0bb6372fe8bb6b496e9953`. The own-PR action was clean against actual main, with all three scanners clean and 89 enabled files.

An earlier whole-branch review and annotation correction remain part of the review history. Both later configured-provider findings received a clear scoped implementation review. Configured Codex review of this exact runtime completed with no findings, and its two earlier threads were handled and resolved. Neither correction changes the schema, defaults, locked dependencies or consumer policy.

## Hosted action evidence

Actual JSON, outputs and artifacts were inspected for these cases. Reports identify the installed runtime, source and target identities, active policy and strict/final verdicts. Controlled missing-scanner cases use a deliberately faulty derivative and are never release targets. Caller audits verified authored tracked bytes, complete working-tree status, index and Git configuration remained unchanged; downstream action outputs and report directories were available.

| Case                           | Run                                                                                                   | Observed result                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Clean, optional reports off    | [39164501149](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39164501149)                  | Clean, final 0 / strict 0                                      |
| New regression                 | [39164378908](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39164378908)                  | Regression, final 1 / strict 1; finding retained               |
| Proposed check disabled        | [39164907101](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39164907101)                  | Target policy retained; final 1 / strict 1                     |
| Proposed policy deletion       | [39164970859](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39164970859)                  | Target policy retained; final 1 / strict 1                     |
| Invalid proposed policy        | [39165035890](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165035890)                  | Operational error, final 2 / strict 2                          |
| All-advisory                   | [39165194218](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165194218)                  | Advisory, final 0 / strict 0; finding retained                 |
| Missing scanner under advisory | [39165288610](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165288610)                  | Operational error, final 2 / strict 2                          |
| Cross-owner execution          | [39164420080, attempt 1](https://github.com/Chronote-gg/Chronote/actions/runs/39164420080/attempts/1) | Clean, final 0 / strict 0; caller unchanged                    |
| Target advanced during scan    | [39164420080, attempt 2](https://github.com/Chronote-gg/Chronote/actions/runs/39164420080/attempts/2) | Stale, final 1 / strict 0                                      |
| Target retargeted before scan  | [39165095198](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165095198)                  | Stale, final 1 / strict 1                                      |
| Safe oversized-test warning    | [39165370050](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165370050)                  | Clean, final 0 / strict 0; exact comma/percent path annotation |
| Literal-backslash source name  | [39164597011](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39164597011)                  | Operational error, final 2 / strict 2                          |

Cross-owner execution used shared defaults on a disposable target without a declared consumer policy. Attempt 1 proves action resolution and execution, not migration acceptance. Attempt 2 used the same source head but observed the owned target alias advance during scanning. Its strict result remained 0 while the final verdict was stale. The real consumer default branch was untouched.

The safe-warning fixture retained the exact `src/oversized,%warning.test.ts` path in its line-1 warning annotation. Cross-owner attempt 1 contained 15 oversized-test entries and emitted 15 safe warnings. GitHub retained 10 warning annotations, its [per-step display limit](https://docs.github.com/en/rest/checks/runs#update-a-check-run). All 15 entries remained in JSON, the summary and logs. This limit does not alter blocking findings or reports.

## Authorized exception transitions

The human authorized label and rationale changes only on the disposable shared probe, including reuse for this corrected qualification. The approved rationale was "Intentional regression in a disposable qualification fixture; this PR will be closed without merging."

| Transition                          | Run                                                                                  | Final / strict result               |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| Label without rationale             | [39165493913](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165493913) | Invalid exception 1 / 1             |
| Exact rationale added               | [39165542115](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165542115) | Exception 0 / 1                     |
| Source push with exception retained | [39165609696](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165609696) | Exception 0 / 1                     |
| Rationale removed                   | [39165666552](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165666552) | Invalid exception 1 / 1             |
| Scanner failure while exempt        | [39165729263](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165729263) | Operational error 2 / 2             |
| Normal runtime restored             | [39165799688](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165799688) | Exception 0 / 1                     |
| Label removed, rationale retained   | [39165846516](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39165846516) | Regression 1 / 1, no current labels |

Findings and strict measurements remained in the reports. Shared PR #2 closed without merging at 2026-10-18T21:01:11Z, with no labels. Cross-owner PR #418 closed without merging at 2026-10-18T20:52:52Z. All seven task-owned probe refs were deleted after exact-tip revalidation, and provider reads confirmed their absence. No consumer policy, deployment or migration was activated.

## Compatibility evidence

Earlier extraction checks compared legacy and shared native duplication under equal thresholds. Prose-only Markdown produced zero rows on both; adding qualifying fenced code produced two rows on both, including one prose row. This limitation remains explicit in coverage.

The earlier immutable comparison left one reviewed runtime boundary unresolved because neither engine reported it in that snapshot. Current-source reconciliation has since verified unchanged source endpoints and registry, with matching endpoint content hashes and unchanged duplication/baseline implementation. The dormant record remains dormant in both engines; unchanged and moved cases pass, and a new copy fails. Edited or newly copied active infrastructure boundaries fail in both. Detailed paths, fingerprints and source evidence remain private. This resolves the boundary question without claiming completed consumer migration.

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

The corrected local suite passed 214/214 with no skips in 77.392 seconds, followed by lint, formatting and schema/example validation. The actual self-policy against the main target reported zero findings in all three scanners. Immutable source and changed-fixture comparisons were repeated after the runtime refactors. This was an intermediate result, followed by the earlier candidate's annotation correction and matrix. Reuse of the immutable comparison for the corrected runtime rests on fresh evidence: 40 measurement-related assets are unchanged, 1,368 normal-path policy comparisons match, and neither exact immutable Git inventory contains a literal backslash. The warning-transport change does not alter measurements. The private comparison was not rerun after these bounded corrections.

The immutable JS/TS suppression-marker path check performed during coordination found no marker-bearing files in either source snapshot. This does not prove current-source acceptance. The documented suppression behavior, native container coverage and conservative identities remain covered by the existing real scanner suites. Current-source migration and hosted checks remain separate acceptance work.

## Remaining publication and migration work

The coordinator must push the docs/test follow-up, inspect exact-head checks and feedback after the required 30-minute window, and integrate PR #1 with a normal merge preserving the selected runtime. The v1.0.0 tag and release must point to that runtime commit, not the documentation follow-up. The current example and local setup already use its full SHA; release validation must pass on the final main-branch documentation.

Local policy preparation, representative current-source fixture comparison and reviewed-boundary reconciliation are complete. Consumer acceptance still requires merged target policies, reviewed hooks and aggregate CI cutover, actual required-check settings, and main-push behavior after an accepted exception. Perkcord also needs its authored-declaration scope decision. Publication alone does not complete consumer migration. See [adoption](adoption.md) for preparation and rollback.
