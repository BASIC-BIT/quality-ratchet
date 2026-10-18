# Acceptance record

## Patch 1.0.1 local evidence

The source selection below is historical. Configured review required follow-up corrections for Git-generated EOL bytes inside touched multiline JSX clones and for the release workflow to execute release-mode validation. The superseded target must not be published or adopted. The follow-up runtime needs fresh local and hosted qualification and a new source/publication selection.

Prior reviewed source Q was `f8b11ee78a488f43ea910b17bf87899ea862559c`, version 1.0.1 and schema 1. The bounded source review passed. On October 18, 2026, local Windows x64 on Node 24.18.0 passed 229 tests, lint, formatting and schema/example checks. Minimum Node 24.15.0 and renewed hosted/platform qualification remain pending. The v1.0.0 runs below do not qualify the patch.

The actual unchanged LF pair and CRLF pair each returned strict exit 0 with no changed files or findings. A genuine new CRLF copy returned exit 1 with one changed file and one blocking finding. All three native clone rows matched between unchanged materializations. Caller source bytes, index and Git configuration remained intact. Structural EOL conversion, quoted/raw literal distinctions, real changed copies and nonzero scanner offsets have direct regression coverage. The [arbitrary-slice tokenizer limitation](releases.md) remains unchanged.

The 47 manifest assets and action.yml define the executable identity. Local asset hash is `be45b1c9ad11318dfb6ffe0ba03cac4723f87ff15c2b467de5ebfd89597c817b`; lock hash is `b940d79a1aaf5f947e3e85516d3f05cd459be40fbc99fc67576a926913e1d804`. Policy, dependency and exception contracts are unchanged. The superseded publication target R was `d93644e0744064841a3a5d734db372443a6bd0ef`. Its archive pins Q safely. This later documentation head E pins R; all 47 manifest assets plus action.yml remain byte-for-byte and Git-blob identical across Q, R and E. See [releases](releases.md#patch-source-and-publication-selection) for the immutable publication sequence.

Hosted patch checks, final source readiness, publication and consumer adoption remain pending. Check the [v1.0.1 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1) for live publication status. No hosted patch result is claimed here.

## Consumer preparation and remaining work

Chronote policy PR #419 merged at `8742782628e04e24e7cff84c056b1c6ff0129d0a`. Perkcord policy PR #1153 merged at `9f2c9e2917bf027f5ca1843682fec64ccfb22721`. These are merged policy references, not a claim about current branch tips. The actual policies were verified. Consumer migrations remain unmerged, neither replacement is active, and existing enforcement remains required.

The human accepted Perkcord's shared declaration exclusions. One authored `.d.mts` file loses duplication coverage; all other parity and local metrics remain required. Current-source boundary reconciliation does not establish completed migration. Acceptance still requires reviewed hooks and aggregate CI cutover, actual required-check settings, representative current-source evidence, and main-push behavior after an accepted exception. See [adoption](adoption.md) for preparation and rollback.

## Initial release qualification, October 18, 2026

Qualified source Q is `9d713408d8c12eb9ced26fe45b4a99e1df5505ff`, version 1.0.0 and schema 1. Corrected hosted tests, action probes and scoped review are complete for Q. Selected release commit R is `84f47115b726d962e73f6c3a06ba69b07cc38ccb`. Its 47 trusted runtime assets plus action.yml are byte-for-byte and Git-blob identical to Q. Version 1.0.0 was published at R on October 18, 2026 at 21:44:38 UTC, release ID 416730393. Its tag and release are unchanged. See the [v1.0.0 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.0).

The earlier `ba9c9bec7c312a303e61b6779591610cd32509b8` candidate was withdrawn before publication after configured review found source-path and warning-transport defects. The runs below qualify Q, except deliberately faulty missing-scanner derivatives identified as such. They are not relabeled as runs at R.

The v1.0.0 release archive at R contains an example that safely pins its corrected source Q. Current adoption examples now select the 1.0.1 candidate described above. The Q and R identifiers in this historical section refer only to v1.0.0.

At the initial qualification snapshot, both consumers retained their existing gates and policy preparation was under review. The current policy and migration status is recorded above.

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
