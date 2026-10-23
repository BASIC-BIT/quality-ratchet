# Acceptance record

## Security patch 1.0.2 qualification

Merged PR #5 source `29686861c96025dc74061ab2494c40d85c7e6cb5` has tree `4f6080c07f2fec8043d0e673e8dcd3ab332312df`, identical to reviewed head `ed571d40b471c9ca34f82cf2bea5d85520408e12`. [CI 39865414504](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39865414504) passed all six PR jobs. Each of the four Ubuntu/Windows minimum/floating Node lanes ran 259 tests with zero failures on Node 24.22.1 and npm 11.19.1. The Linux production package smoke and own-PR quality job also passed.

[Release check 39927791916](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39927791916) then qualified exact release candidate R, `84fa993cf93b9dedd4da19ecbad75bc8712d0874`, with tree `7073adbb9ee8d9ca468b25550484a9c623406621`. All four platform/Node lanes resolved R, passed 259 tests each and executed the `--release` validators. Linux production package smoke passed. The non-PR quality job skipped by design. Candidate manifests reported asset hash `9eac9c41f52924a91952b71e092d758a15a078bfdda68722906066c4e88e7c6d` and lock hash `a05ac70aa0ef35310e77f281e492d45e82ccee9bb5e730d09002f42cf5eb99b2`.

The 1.0.2 preparation changes only package version metadata and release/adoption documentation. Source, tests, dependencies, schema, policy, action and workflows remain unchanged. R's archive retains its pin to versioned source `4dd0e2056b6e7b36cb805dc75421fbe32e811a54`. Current examples and local setup pin qualified R; later documentation changes do not alter its archive or runtime assets.

Use the [v1.0.2 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.2) for authoritative publication status and verify that its tag resolves to `84fa993cf93b9dedd4da19ecbad75bc8712d0874` before consumer activation. Qualification does not establish publication, post-merge candidate CI or consumer acceptance. See [publication requirements](releases.md#candidate-identity-and-publication).

## Published 1.0.1 record

Version 1.0.1 is [published](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1) and qualified for adoption. The final release check, PR CI and post-merge source CI passed. Consumer migrations remain pending at the October 19, 2026 UTC snapshot. Both consumers keep existing default-branch enforcement; [adoption](adoption.md) records the remaining cutover requirements.

## Patch 1.0.1 publication and hosted qualification

The amended [Release check 39176654614](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39176654614) completed successfully with workflow definition E3 and candidate R3 in every job. All four `--release` validation steps executed and passed. [Final PR CI 39176656062](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39176656062) passed all six jobs at E3. Each platform and Node combination below ran 255 tests with zero failures or skips in each workflow.

| Platform | Node    | Release-check duration | Final PR CI duration |
| -------- | ------- | ---------------------: | -------------------: |
| Ubuntu   | 24.15.0 |               71.959 s |             69.889 s |
| Ubuntu   | 24.21.0 |               62.429 s |             57.653 s |
| Windows  | 24.15.0 |              470.150 s |            572.102 s |
| Windows  | 24.21.0 |              384.343 s |            471.643 s |

The production-only Linux Node 24.15.0 package smoke passed in 9.295 seconds in Release check and 9.462 seconds in final PR CI. The non-PR quality job in Release check skipped as designed. Final PR CI's own-PR JSON artifact reported clean, final 0 / strict 0. All three scanners exited 0 with no errors or findings. Eligible-file counts were 92/71/71 and changed-file counts were 22/13/13. Head, base, policy, tree and manifest identities matched the expected inputs.

[Post-merge source CI 39178578401](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39178578401) completed successfully at the integrated main commit, with its final update at `2026-10-19T00:05:29Z`. All four platform checks and the Linux production package job succeeded; the non-PR quality job skipped as designed. This verifies source integration, not product deployment or runtime behavior.

PR #3's post-window audit at `2026-10-18T23:56:19Z` refreshed checks, comments, inline threads, reviews, mutable AI summaries and mergeability for exact head E3. Checks were terminal and acceptable, mergeability was clean and no blocking feedback remained. Configured Codex review cleared E3, and an immediate second mutable-summary refresh remained clear. Copilot quota was unavailable; no Copilot approval is claimed. PR #3 merged normally at `2026-10-18T23:56:32Z`, after the required 30-minute window.

### Publication identities

| Evidence                         | Exact value                                |
| -------------------------------- | ------------------------------------------ |
| Reviewed runtime Q2              | `bb24eb0e00420cc0691c69590f4f06f63dccc60e` |
| Qualified source and fixture Q3  | `b256189fa96e1a460609917a8a56383f793b4216` |
| Published tag target R3          | `0873869f6b8fd80150d24689849ec0aebd94e9dd` |
| Final documentation head E3      | `a70be518f65e23ea58ad66f255dc57711a4ac035` |
| Integrated main commit           | `07651cc73aeae00f0bc695875c10df8d6323a54b` |
| Integrated tree, identical to E3 | `1318053e0244a47ad8a85167dc561e9e46a20b6a` |
| Release ID and publication time  | 416782245, `2026-10-18T23:57:06Z`          |
| Final own-PR JSON artifact       | 12154572937                                |

The release is neither draft nor prerelease. All 48 trusted manifest assets, action.yml and CI are unchanged across Q3/R3/E3. The integrated release validator, source manifest and clean-status checks passed. The tag archive safely pins Q3; at E3, the examples and local setup pinned R3. The immutable tag and archive remain unchanged. The runtime and lock hashes appear in the local evidence below.

## Patch 1.0.1 local evidence

Reviewed runtime Q2 is `bb24eb0e00420cc0691c69590f4f06f63dccc60e`, version 1.0.1 and schema 1. Its scoped source review passed with no open findings. On October 18, 2026, local Windows x64 on Node 24.18.0 passed 255 tests with zero failures or skips, followed by lint, formatting and schema/examples. Its focused contracts passed 36 tests, and the own strict scan reported zero findings. These are historical same-runtime results, not a complete run at the final source/fixture selection.

Source and fixture Q3 is `b256189fa96e1a460609917a8a56383f793b4216`. It adds only an explicit repository-local `core.autocrlf=true` setting to the unchanged-clone fixture, before source creation and commit. The assertions and runtime remain unchanged. A neutral run with global `core.autocrlf=false` reproduced the earlier Ubuntu assertion, then 31 affected tests passed after correction on Windows Node 24.18.0, with zero failures or skips. The scoped fixture review passed. The final hosted qualification above subsequently exercised this fixture selection on both platforms and Node versions. Historical v1.0.0 runs below remain attributed to that release.

The seven Q2 real CLI cases use actual Git and native scanners and preserve caller source bytes, index and configuration:

| Case                                                       | Strict exit | Findings |
| ---------------------------------------------------------- | ----------: | -------: |
| Unchanged LF                                               |           0 |        0 |
| Unchanged CRLF checkout                                    |           0 |        0 |
| Harmless comment touches in CRLF clones                    |           0 |        0 |
| Literal-content change                                     |           1 |        1 |
| Genuine new copy                                           |           1 |        1 |
| Authored EOL-only literal edit with conversion disabled    |           1 |        1 |
| Authored EOL-only literal edit with a preserved CRLF index |           1 |        1 |

Read-only Git metadata establishes effective text/eol/autocrlf and index provenance. Comparison hashes and in-memory duplication identity share a byte projection that removes CR only before LF where Git conversion applies. Raw scanner input and immutable hosted blobs retain exact bytes. Authored EOL-only edits that Git preserves retain hunks and block. The [arbitrary split-literal tokenizer limitation](releases.md#behavior-and-limits) remains unchanged.

The executable identity includes 48 manifest assets, plus action.yml and the CI workflow as separately recorded control-plane files. Asset hash is `37bbe42c83c9a3a2ea0fa2a61ec7d2812aa336c35046d3835654bdfe7547a2ca`; lock hash is `b940d79a1aaf5f947e3e85516d3f05cd459be40fbc99fc67576a926913e1d804`. Package/dependency mappings, policy and exception contracts are unchanged. Q3 retains that executable identity. Published release commit R3 is `0873869f6b8fd80150d24689849ec0aebd94e9dd`; its archive safely pins Q3. Final documentation head E3 pins R3. All 48 manifest assets plus action.yml and CI are byte-for-byte and Git-blob identical across Q3/R3/E3. See [releases](releases.md#patch-source-and-publication-selection) for the publication sequence.

Release-check delegates its candidate to reusable CI, whose nonempty-candidate route invokes `node scripts/validate-examples.mjs --release`. The source route and real positive/negative local validator checks passed. Intermediate hosted own-PR execution was clean, and the earlier manual Linux production smoke passed on Node 24.15.0. Both earlier Ubuntu suites failed at the fixture setup corrected in Q3. Those results remain historical; the final hosted runs above qualify the published selection. Consumer adoption remains separate.

## Consumer preparation and remaining work

Chronote policy PR #419 merged at `8742782628e04e24e7cff84c056b1c6ff0129d0a`. Perkcord policy PR #1153 merged at `9f2c9e2917bf027f5ca1843682fec64ccfb22721`. These are merged policy references, not a claim about current branch tips. The actual policies were verified. [Chronote migration PR #421](https://github.com/Chronote-gg/Chronote/pull/421) remains open and unmerged, with CI and review in progress. Perkcord remains in local qualification and has no migration PR. Neither replacement is active, and both consumers retain existing default-branch enforcement. Perkcord required-context activation remains unapproved.

The human accepted Perkcord's shared declaration exclusions. One authored `.d.mts` file loses duplication coverage, the only accepted coverage loss. All other local hooks, reports, metrics, aggregation and exception behavior remain required. Comparisons at the final release pin verified the reviewed duplication boundaries and matching debt/size reports in private evidence. Normal commit hooks, checks of each consumer's entire current tree and hosted migration acceptance remain pending. Acceptance still requires reviewed hooks and aggregate CI cutover, actual required-check settings, representative current-source evidence, and main-push behavior after an accepted exception. Exact accepted heads, merges and settings readbacks belong in the consumer cutover record. See [adoption](adoption.md) for preparation and rollback.

## Initial release qualification, October 18, 2026

Qualified source Q is `9d713408d8c12eb9ced26fe45b4a99e1df5505ff`, version 1.0.0 and schema 1. Corrected hosted tests, action probes and scoped review are complete for Q. Selected release commit R is `84f47115b726d962e73f6c3a06ba69b07cc38ccb`. Its 47 trusted runtime assets plus action.yml are byte-for-byte and Git-blob identical to Q. Version 1.0.0 was published at R on October 18, 2026 at 21:44:38 UTC, release ID 416730393. Its tag and release are unchanged. See the [v1.0.0 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.0).

The earlier `ba9c9bec7c312a303e61b6779591610cd32509b8` candidate was withdrawn before publication after configured review found source-path and warning-transport defects. The runs below qualify Q, except deliberately faulty missing-scanner derivatives identified as such. They are not relabeled as runs at R.

The v1.0.0 release archive at R contains an example that safely pins its corrected source Q. At the October 19, 2026 UTC snapshot, adoption examples pinned published 1.0.1 as described above. The Q and R identifiers in this historical section refer only to v1.0.0.

At the initial qualification snapshot, both consumers retained their existing gates and policy preparation was under review. The October 19, 2026 UTC policy and migration snapshot is recorded above.

### Corrected runtime qualification

[CI run 39164339027](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39164339027) passed all six jobs on qualification source Q. Each platform ran 223 tests with no failures or reported skips, followed by lint, formatting and schema/example validation.

| Platform | Node    | Test duration |
| -------- | ------- | ------------: |
| Ubuntu   | 24.15.0 |      67.913 s |
| Ubuntu   | 24.21.0 |      66.913 s |
| Windows  | 24.15.0 |     387.772 s |
| Windows  | 24.21.0 |     476.229 s |

The real POSIX working-file literal-backslash test executes on Ubuntu. Its body returns early on Windows, so the reported zero skipped tests does not imply Windows exercised that POSIX fixture. The real 23,000-warning bootstrap test passed in all four jobs with one parent warning publisher and no child-buffer overflow.

The Linux production-only package smoke passed in 5.136 seconds; the serial local production-only smoke passed in 17.058 seconds. All four platform manifests matched runtime asset `01aca099cfa27459b5a6c25d39f386aecd68a0e9dcbe21f0e93041c7da7a8168` and lock `f7401eb223be14df24b406248c918248074476d6be0bb6372fe8bb6b496e9953`. The own-PR action was clean against actual main, with all three scanners clean and 89 enabled files.

An earlier whole-branch review and annotation correction remain part of the review history. Both later configured-provider findings received a clear scoped implementation review. Configured Codex review of this exact runtime completed with no findings, and its two earlier threads were handled and resolved. Neither correction changes the schema, defaults, locked dependencies or consumer policy.

### Hosted action evidence

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

### Authorized exception transitions

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

### Compatibility evidence

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
