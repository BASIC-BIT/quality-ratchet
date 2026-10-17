# Shared quality-ratchet action

Status: Approved in chat on 2026-10-16, including the Perkcord migration requirements and repository-specific configuration revision. The implementation plan was approved on 2026-10-17. The user selected subagent-driven execution, with task-scoped implementation and reviews.

Date: 2026-10-16

## Review brief

Create public `BASIC-BIT/quality-ratchet` as the maintained home of the complexity, duplication, and file-size checks used by Chronote and Perkcord. Both repositories are initial migration targets. Each calls one versioned GitHub Action instead of carrying its own scanner code, dependencies, and regression tests.

The action prevents new or worsening debt while allowing existing violations to remain or improve. Reviewers retain the approved escape hatch: a PR-wide `quality-exception` label and a written rationale that remain active across pushes. A missing scanner or broken check remains blocking.

The shared implementation supplies defaults; each repository owns its policy in a versioned configuration file. Repositories can select thresholds, check modes, source and language scope, path-specific complexity/file-size settings, and advisory reporting. A configuration change is a durable policy decision reviewed in Git, while the label and rationale accept the regressions in one PR.

The first release checks JavaScript/TypeScript complexity and file size, including tests and scripts. Duplication coverage also preserves Perkcord's existing broader scanner coverage, including documentation, shell, configuration, and infrastructure files. It carries Perkcord's test-debt reports and oversized-test advisory into the shared tool. It provides one required check with useful locations and measurements, without installing or executing the consuming application's dependencies, build scripts, or ESLint configuration.

Compared with the first draft, this design preserves Perkcord's broader duplication coverage, names it as the second adopter, and supports repository-specific policy instead of fixed thresholds. It does not equate Perkcord's legacy Lizard function-length check with the file-size check. That separate check stays in place during the initial migration unless its replacement is explicitly designed and approved.

### Decisions for this review

| Decision           | Recommendation                                                                                                                               | Tradeoff                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Integration        | A root composite action, with a documented consumer workflow template.                                                                       | Consumers retain a small workflow for events, permissions, runner selection, and the required job name. The action owns execution and policy.    |
| Policy flexibility | Shared defaults plus versioned repository settings for thresholds, modes, scopes, path overrides, and reports.                               | Supports different repo needs without checker forks. Reviewers must inspect policy changes, and the report must show what was actually enforced. |
| Updates            | Consumers pin release commit SHAs. Use automated dependency-update PRs where enabled.                                                        | A fix is maintained once, but each consumer adopts the new release through review.                                                               |
| Local use          | Keep a strict command in the same source tree, usable from a pinned local tool checkout.                                                     | Agents can reproduce findings before pushing. No separate npm package or installation service is needed for v1.                                  |
| Licensing          | Preserve existing license and attribution notices during extraction, and review the complete source/dependency inventory before publication. | Chronote's root license is AGPL-3.0. A different license is a separate decision requiring confirmed rights to the extracted code.                |

The user approved the implementation plan on 2026-10-17 and authorized creation of the public shared repository and generic checker extraction. Release, consumer migration, branch-rule, exception-label, merge, and deployment gates remain as specified in the plan.

## Confirmed scope and success

Confirmed by the user:

- The maintained home is a dedicated, publicly readable `BASIC-BIT/quality-ratchet` repository.
- Portfolio repositories use the shared action instead of copied checker implementations.
- Repository-specific needs are supported through configuration, with one maintained engine and documented defaults.
- Chronote and Perkcord are the first two intended consumers. Account for the existing quality checks in both before retiring either implementation.
- The initial gate combines complexity, duplication, file-size limits, and Git-relative ratcheting.
- A single `quality-exception` label and rationale cover the PR and persist across pushes.
- Operational failures cannot receive an exception.

Success means a checker fix, scanner upgrade, or behavior test is authored once in the shared repository. For the shared checks, a consumer contains only its workflow, optional policy configuration, local invocation instructions, and required-check setup. Existing checks outside that shared scope stay explicit and retain their enforcement. Both repositories' behavior is covered during extraction, with policy differences recorded rather than silently discarded.

The initial rollout proves the shared action in Chronote and `Perkcord/perkcord`. Perkcord supplies a different monorepo layout, `main` default branch, npm setup, Convex-generated output, and existing CI aggregation. Repository-specific edits and settings changes must be listed in the implementation plan. If a parity issue prevents either migration, retain its current gate and report the unresolved requirement instead of declaring the two-repository rollout complete.

This work does not clean up existing code, add application lint/type/test checks, change deployment authority, create a GitHub App, or build a hosted analysis service. Complexity and file-size analysis for other languages, migration of legacy scc/Lizard metrics, merge queues, and organization-wide mandatory workflows are deferred. Broader duplication coverage already used by Perkcord is part of v1.

## Current checks in both repositories

The Perkcord comparison uses live default-branch source, not an older local checkout. The inventory covers deterministic maintainability checks and their local/CI integration. Application tests, type checking, lint/format, security scanning, deployment controls, and optional agent-led audits remain owned by each product repository.

| Existing check or behavior                | Chronote                                                                              | Perkcord today                                                                                                                                                                                                        | Shared design and migration treatment                                                                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cyclomatic and cognitive complexity       | Both thresholds are 15; new or worsening touched offenders fail.                      | Same thresholds and Git-relative rule, with script-owned ESLint/SonarJS configuration.                                                                                                                                | One blocking implementation. Preserve Perkcord's object-literal/Convex handler identities as well as Chronote's later lexical-owner and duplicate-name protections.                                                                           |
| File-size growth                          | New files must stay below 1,000 physical lines; existing oversized files cannot grow. | Same 1,000-line rule.                                                                                                                                                                                                 | One blocking implementation with module variants and rename handling.                                                                                                                                                                         |
| New duplication                           | At least 8 lines and 50 tokens, initially scoped to JS/TS.                            | Same thresholds, but scans the pinned jscpd engine's broader supported formats.                                                                                                                                       | Support both scopes in one engine. Preserve Perkcord's broader coverage and record Chronote's JS/TS scope in its migration config unless a broader policy is separately agreed.                                                               |
| Tests, stories, fixtures, and E2E support | Included by default in the gate.                                                      | Individual commands skip tests by default, but `check:commit` and CI pass `--include-tests` for all three gates.                                                                                                      | Include tests in the shared gate by default. The bare Perkcord command's narrower default is not its enforced commit/CI policy.                                                                                                               |
| Absolute test-debt inventory              | No equivalent standalone report in the extracted gate.                                | `report:test-debt` reports test-involved duplicates, same-file/cross-file pairs, hotspots, test-source lines, and files at least 1,000 lines long.                                                                    | Shared diagnostic report using the same scan data. Absolute debt totals never decide merge eligibility.                                                                                                                                       |
| Oversized-test advisory                   | Oversized test files follow the growth rule.                                          | `check:test-size` emits non-failing warnings for test/support files at least 1,000 lines long.                                                                                                                        | Preserve advisory warnings alongside the blocking growth rule. An unchanged large test may warn and still pass.                                                                                                                               |
| Reviewed exact clone boundaries           | No path/fingerprint allowance registry.                                               | Three exact boundaries: one runtime pair and two pairs in separate Terraform roots. Each pins paths, ranges, and fingerprints.                                                                                        | Do not embed Perkcord business paths or add a general suppression registry. Prove ordinary Git grandfathering preserves the already-reviewed unchanged pairs. Changed, moved, or newly copied boundaries require explicit parity review.      |
| Exception policy                          | PR-wide label plus rationale, persistent across pushes; operational failures block.   | No equivalent label policy in the inspected gate. Complexity/size CLIs expose `--warn-only`; comments do not technically waive a failing gate.                                                                        | Adopt the agreed label/rationale policy in both. Shared strict commands have no warning-only bypass. Report this as a deliberate Perkcord policy change.                                                                                      |
| Metrics job                               | scc and unsuppressed Lizard diagnostics, with execution errors still blocking.        | Separate scc and Lizard job. Lizard uses `-C 25 -L 300 -w`, authored target paths, and file exclusions.                                                                                                               | Retain existing metrics integration initially. The 300-line Lizard limit is function length, not the 1,000-line file-size limit. `-w` controls output formatting, not whether warning counts can fail.                                        |
| Local and CI wiring                       | Local quality command and a dedicated required PR check.                              | `check:commit` invokes all three gates from the commit hook; CI's `format` job also runs them, their tests, and the advisory. `application-ci` consumes that job's result. Main pushes compare with the pre-push SHA. | Preserve local commit coverage and update CI aggregation explicitly. Retire copied gate execution only after the shared required PR check is proven. Reconcile post-merge checks so an approved PR exception cannot fail again after merging. |

The inspected implementation also pins jscpd, its tokenizer, and SonarJS to the same versions already used by Chronote. Align the remaining parser/runtime dependencies in the shared tool rather than relying on either application's installation.

### Differences that must be resolved before retiring Perkcord's gate

Broader duplication coverage and advisory reports are requirements for the shared implementation, not optional cleanups after migration. Preserve Perkcord's regression cases for Markdown table layout, embedded fenced JS/TS and shell, YAML scalar hashes, shell comments, Python comment changes, source ranges, and clone identity. Merge these with Chronote's later correctness fixes instead of choosing one repository's checker wholesale.

The reviewed-boundary inventory is migration evidence, not a new shared allowance mechanism. Compare each unchanged pair and representative edits against both gates. If ordinary Git baseline matching produces an unexplained behavior difference, resolve it through a documented policy decision, a source refactor, or the agreed PR exception. Otherwise leave Perkcord's duplication gate active until the mismatch is resolved. Do not silently accept extra findings or broadly exclude those files.

Keep Perkcord's scc/Lizard job and its CI aggregation in place during the shared-check migration. Moving or retiring it is a separately reviewed change because it includes a function-length check the shared gate does not implement. Verify warning exits and selected-path behavior from the pinned executable during implementation; a green workflow definition alone is not runtime evidence.

Perkcord currently rechecks new debt on main pushes. The proposed shared GitHub adapter is PR-only. Its migration must explicitly replace the old post-merge ratchet execution while preserving unrelated push checks, verify branch protections cover the intended merge path, and show that an accepted exception does not block later CI or deployment. No deployment authorization or unrelated CI bypass is added.

## Author and reviewer experience

1. An author runs the pinned shared tool against their working tree. Findings identify the affected file, function or duplicate partner, current measurement, and baseline measurement where applicable.
2. A PR runs a dedicated job named `Code quality ratchet`. The action analyzes the proposed merge against the live target branch using its own scanner versions and policy.
3. The summary shows the effective repository policy, including overrides, advisory modes, disabled checks, and excluded scope. A clean enforced scan passes. A blocking regression fails with an explanation and suggested remedies, such as simplifying a function, splitting a file at a meaningful boundary, or sharing repeated logic. Advisory findings stay visible without blocking.
4. For an intentional regression, the author adds a rationale under the exact `## Quality exception` heading. A maintainer applies `quality-exception`. Agents require explicit human authorization before applying the label.
5. Every push rescans the PR. Label and PR-description changes also rerun the job. The label stays active; the report continues to show current findings and the rationale.
6. Removing the label restores strict enforcement. Removing the rationale while retaining the label fails, including when scanners are clean.

GitHub's label permissions enforce who can apply the label. They cannot distinguish a person from an agent using that person's token. Human review assesses whether the rationale is convincing; the action checks that a real rationale is present.

Local results enforce the same active repository policy and do not query GitHub for exemptions. An exempt PR may fail the local command. A configured advisory remains advisory locally as well as in CI. Once an exempt regression merges, the resulting code becomes ordinary Git baseline debt for later PRs. The exception does not schedule cleanup or preserve an earlier ceiling.

## Integration choice

| Approach                                  | Benefit                                                                                       | Cost                                                                                                                       | Decision                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Root action called from a small workflow  | Matches `uses: BASIC-BIT/quality-ratchet@<sha>`, owns its dependencies, and fits existing CI. | Each consumer retains trigger and job wiring.                                                                              | Recommended for v1.                                |
| Reusable workflow calling a shared action | Also centralizes runner, job, and artifact wiring.                                            | Adds another public entry point and requires coordinating the workflow/action release references and check-name migration. | Consider later if consumer wiring actually drifts. |
| Copy scripts through a workflow template  | Easy initial adoption.                                                                        | Every checker fix must be copied again; implementations drift.                                                             | Rejected.                                          |

Use a composite action so preparation, runtime setup, scan, policy, and artifact upload remain visible steps. A JavaScript action with bundled scanner dependencies is a possible future optimization; packaging native CLI entrypoints and tokenizer assets is unnecessary release complexity for the first extraction. Docker packaging is deferred because v1 does not need another image release or container boundary.

The consuming workflow owns `pull_request` events for `opened`, `synchronize`, `reopened`, `ready_for_review`, `edited`, `labeled`, and `unlabeled`. It has no path filter, uses per-PR concurrency with cancellation, grants `contents: read` and `pull-requests: read`, sets a 20-minute timeout, and uses the exact required job name. It checks out the event's exact PR head with full history and credentials persistence disabled before calling the action.

The action validates the event and checkout rather than assuming the template was followed. Unsupported events, an unexpected head, missing Git history, insufficient permissions, or a missing GitHub token fail with an operational error. A composite action cannot supply caller triggers, permissions, concurrency, job names, or branch-protection settings. Document and test these adoption requirements explicitly.

GitHub Actions must be enabled and the consumer's action policy must allow this public action and its pinned nested actions. Public distribution works across GitHub owners without a private cross-organization credential. It exposes checker code, not the consuming project's source repository.

## Shared default policy

These defaults preserve the initial checks. A repository can change the supported policy settings through the configuration contract below. Ratcheting always compares both trees under the same effective settings.

| Check       | Measurement and rule                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity  | Script-owned ESLint cyclomatic and SonarJS cognitive complexity. Values up to 15 pass. A touched new offender fails; an existing offender fails if either measure increases. Improvement in one measure does not offset growth in the other. |
| File size   | Physical lines, consistently counted for LF/CRLF. New files must be below 1,000 lines. Existing files fail if they grow and their resulting size is at least 1,000 lines. A terminal newline does not add an extra line.                     |
| Duplication | New token clones of at least 8 lines and 50 tokens fail. Scan all eligible source to find copies of unchanged code, then compare fingerprints and changed ranges against the baseline. Preserve old, moved, and shortened clone handling.    |

Complexity and file-size checks cover authored `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts` files, including tests, fixtures, stories, root configuration, and scripts. Duplication additionally covers the broader formats recognized by the pinned jscpd engine used in Perkcord. Its current normalization handles CSS, HCL/Terraform, HTML, Markdown/MDX, PowerShell, Python, shell, TOML, and YAML as well as JS/TS. Enumerate and test the supported format mapping from the pinned engine; the normalization map alone is not proof of scanner coverage.

Use a separate eligibility policy for each scanner. Do not hardcode duplication to a JS/TS-only path filter. Preserve the pinned scanner's existing broad capability while replacing implicit ignores and size limits with explicit Git-owned snapshots. Each repository chooses its active formats and paths through configuration. Publish the supported extension/format inventory with the tool and report out-of-scope languages honestly. Additional-language complexity/file-size support remains deferred.

Default exclusions cover dependencies, generated code and declarations, build outputs, coverage, Git metadata, nested worktrees, and known generated framework output. Repository configuration can narrow authored scope, including test or fixture paths, while generated files remain excluded. Always exclude tool/dependency storage, Git metadata, and symlinks regardless of project configuration. Apply each scanner's effective scope consistently to baseline and current source. Report scanned, excluded, disabled, and inapplicable scopes separately; zero eligible JS/TS files does not claim complexity analysis of another language.

Tracked eligible source participates even when it matches `.gitignore`. Ignored untracked scratch files do not. Local scans include eligible nonignored untracked source. CI analyzes the recorded Git merge tree, with temporary tooling and reports stored outside the source snapshot.

Retain exact normalized duplication fingerprints, including literal distinctions, Git rename handling, deletion boundaries, explicit diff prefixes, and protection against scanners' implicit ignore and size limits. Do not replace the gate with a repository-wide duplication percentage.

Retain function identity based on lexical owners, names, and callback ordinals. Changes to indistinguishable same-name function counts use conservative matching. Renaming a function, inserting callbacks, or an unrecognized file move can make an old offender appear new. Document these limits instead of promising perfect semantic identity.

Both baseline and current source use the same tool release, scanner versions, configuration, and thresholds within a run. No metric improvement elsewhere pays for a regression.

## Shared diagnostic reports

Carry Perkcord's test-debt reporting into the same maintained implementation, enabled by default. In hosted runs, derive the test-involved clone summary from the complete current duplication scan within its configured scope, and collect the eligible JS/TS test-source inventory. Report test-to-test and test-to-source pairs, same-file and cross-file pairs, hotspot participation, source counts/lines, and files at least the configured advisory threshold long, defaulting to 1,000. Sort results deterministically. Explain that overlapping clone spans do not measure removable lines and that excluded paths are not covered by an absolute inventory.

When enabled, emit non-failing annotations for oversized test/support files, including stories, E2E support, and fixture modules. Existing large tests may warn without failing; new or growing oversized tests fail when they violate the applicable ratcheting file-size rule. High absolute duplication totals and existing large-file counts cannot turn a clean delta into a regression or require an exception.

Keep advisory data separate from blocking findings and include it in JSON artifacts and a bounded summary. Reuse current scan data rather than invoking a second whole-repository clone scan during a PR. The strict local check remains the normal pre-commit command. Separate on-demand `report-test-debt` and `report-test-size` commands expose the diagnostic views without making them merge gates. Failure to produce an enabled report is an operational failure; intentionally disabled reports are recorded as disabled, and the size or debt measurements themselves are informational.

## Configuration contract

### Repository-owned settings

Use an optional root `quality-ratchet.json` with `schemaVersion: 1`. Absence means the shared defaults above. Ship one JSON Schema for editor completion and runtime validation. Configuration contains data only; do not execute project code or load its lint configuration.

| Setting                             | Supported behavior                                                                                                                                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope.include` and `scope.exclude` | Repository-relative glob arrays controlling authored paths. Default include is all supported authored source. Explicit exclusions can cover generated files, fixtures, tests, or a package that has a different owner. Report them rather than assuming every exclusion means generated code. |
| `checks.complexity`                 | `mode`, independent positive integer `cyclomatic` and `cognitive` thresholds, and optional `include`/`exclude` glob arrays. Defaults are `ratchet`, 15, and 15.                                                                                                                               |
| `checks.fileSize`                   | `mode`, positive integer `maxLines`, and optional `include`/`exclude` glob arrays. Defaults are `ratchet` and 1,000. The existing less-than/new-file and no-growth/legacy semantics remain the same.                                                                                          |
| `checks.duplication`                | `mode`, positive integer `minLines` and `minTokens`, optional `include`/`exclude` globs, and an optional `formats` array restricted to formats supported by the pinned engine. Defaults are `ratchet`, 8 lines, 50 tokens, and the shared supported format inventory.                         |
| `overrides`                         | Ordered entries with `files` glob patterns, a nonempty `reason`, and complexity/file-size settings under `checks`. Useful for test suites, scripts, or different monorepo packages. No per-path duplication thresholds or modes in v1, because a clone can span two policy regions.           |
| `reports.testDebt`                  | Boolean controlling the absolute test-debt view. Default true when duplication is enabled, otherwise false. Explicit true requires an enabled duplication scan; an inconsistent combination is an error rather than a silent extra scan.                                                      |
| `reports.testSize`                  | `enabled` and positive integer `oversizedLines` for the non-failing test-size advisory. Defaults are true and 1,000. This advisory threshold is independent of the blocking file-size policy.                                                                                                 |

An omitted setting inherits its default. Each check's mode is `ratchet`, `advisory`, or `off`. Ratchet mode blocks new or worsening debt. Advisory mode computes the same measurements and regressions but reports them without blocking. Off skips that scope and records the skipped coverage. Require a nonempty `reason` when selecting advisory/off globally or through an override; the override entry's reason can supply it. Reasons explain policy to reviewers; the action does not score their quality.

Determine enabled coverage after resolving per-path overrides. A globally off complexity or file-size check can have an enabled package-specific override. At least one check must be enabled with an actual eligible scope. All-advisory rollout is supported and explicitly reported as having no blocking ratchets. An all-off configuration or a scope that silently removes all eligible coverage is an error. A parser, scanner, history, or report failure in an enabled check remains operationally blocking even in advisory mode. A deliberately disabled scanner is not a missing required dependency.

Global scope filters are applied first, followed by the scanner's supported-language filter and its own include/exclude filters. Override patterns match repository-root-relative paths with `/` separators and case-sensitive matching. Matching uses glob semantics only, with no shell expansion, parent traversal, or absolute paths. Documentation must specify the supported glob syntax and cover Windows path normalization in tests. Arrays replace inherited arrays; object fields merge by key. Apply matching overrides in declaration order, with the last explicit setting winning. Record the matching override indices and final values for each reported finding.

An override may set only complexity `mode`/`cyclomatic`/`cognitive`/`reason` or file-size `mode`/`maxLines`/`reason`; it cannot introduce nested overrides, replace source discovery, or restore an excluded path. When an inherited mode is advisory/off, retain its reason unless the matching override supplies a replacement. For a recognized renamed file, apply the destination path's effective thresholds to both its baseline and current measurements. Two endpoints of a duplicate use the one repository-wide duplication policy, avoiding an ambiguous choice between path-specific thresholds. Both endpoints must be in that scanner's declared scope.

Unknown keys, invalid modes, nonpositive/noninteger thresholds, unsupported format names, malformed globs, empty override match lists, invalid reasons, and unsupported schema versions are configuration errors. Validate the complete document, including proposed configuration in the prepared merge tree. A new proposed file must parse correctly even though it is not yet used for enforcement. Defaults and examples must remain useful without requiring every repository to restate all fields.

### Example of a repository policy

This example keeps the default checks while giving large test modules a reviewed 1,500-line file-size policy. It does not raise the complexity thresholds or change the independent 1,000-line test-size advisory.

```json
{
  "schemaVersion": 1,
  "scope": {
    "exclude": ["convex/**/_generated/**"]
  },
  "checks": {
    "complexity": { "cyclomatic": 15, "cognitive": 15 },
    "fileSize": { "maxLines": 1000 },
    "duplication": { "minLines": 8, "minTokens": 50 }
  },
  "overrides": [
    {
      "files": ["**/*.test.ts", "test/**"],
      "reason": "Keep related test scenarios together while preventing further growth above the agreed limit.",
      "checks": { "fileSize": { "maxLines": 1500 } }
    }
  ],
  "reports": {
    "testDebt": true,
    "testSize": { "enabled": true, "oversizedLines": 1000 }
  }
}
```

The numbers above illustrate supported configuration, not a proposed change to Chronote or Perkcord. Their migration files must explicitly preserve the inspected enforced thresholds, inclusion of tests, and each repository's agreed scanner scope. Document any deliberate difference in the migration PR instead of treating configurability as authorization to relax those policies.

### Configuration changes and PR exceptions

For PR runs, load the configuration from the fetched target commit, then apply the same effective settings to baseline and current trees. A PR editing thresholds, modes, scope, or overrides still runs under the existing target policy. Validate its proposed configuration and show the effective policy difference; the proposed settings take effect for later PRs after merging. The first configuration addition similarly runs under the defaults until merged. A PR that needs an immediate exception uses the existing label and rationale.

Always show default versus overridden values, disabled/advisory checks, excluded scope, the active config commit and normalized policy hash, and a concise proposed-policy difference when present. This keeps a reported success understandable even when two repositories intentionally enforce different settings. The action cannot prove that a chosen threshold is appropriate; maintainers review that decision in Git.

The local command resolves its comparison baseline first and loads configuration from that commit. It reports both the active configuration and any proposed working-tree change. Provide an `explain-config` command, with `--repo`, `--base`, and `--json`, to inspect resolution and pending policy changes without claiming a scan passed under them. There are no ephemeral threshold, mode, or scope overrides through action inputs, environment variables, or the strict check's CLI.

Keep `quality-exception`, its exact heading, persistence across pushes, and the prohibition on exempting operational errors as shared behavior in v1. Source-comment suppressions, executable plugins, and fingerprint-specific allowlists remain outside the configuration contract. New rule or language engines require a shared release, not a project-supplied command. Configuration is policy owned by repository maintainers, not an adversarial authorization boundary.

## Execution architecture

Keep four responsibilities separate inside the shared repository:

- Git/source handling resolves baseline commits, authored paths, changed ranges, snapshots, and recognized renames.
- Scanner modules measure complexity, duplication, and file size, and produce validated findings. Shared reporting functions derive absolute test-debt and size advisories from the current data without changing the regression verdicts.
- A combined runner executes every enabled scanner, records intentionally disabled scopes, validates complete outcomes, and returns a verdict under the active policy.
- The GitHub adapter prepares the comparison, obtains live metadata, applies the pure exception policy, and publishes the summary and artifacts.

The root `action.yml` orchestrates these modules. Public action inputs are a `github-token` and a `repository-path` defaulting to the checked-out workspace. The token is the consumer's read-only `github.token`, passed explicitly. The repository path must resolve to a Git checkout inside the workspace. The configuration filename, exception metadata, event handling, and report locations are fixed in v1; scan policy comes from the validated repository file.

### What happens during a PR run

1. Validate the checkout, event, runtime prerequisites, and inputs. Record the event head and target branch identity.
2. Set up the action's pinned Node 24 runtime. Copy tool files to an action-owned temporary directory, then install the action's locked production dependencies with lifecycle scripts disabled. Dependencies resolve from the tool directory, never the consuming application.
3. Fetch the live target branch with temporary read-only authentication. Create an isolated comparison checkout, materialize the merge of the exact PR head and fetched target tip, and record the resulting tree. A merge conflict blocks execution. Keep the consumer checkout intact and remove temporary credentials immediately after fetch.
4. Read baseline configuration, validate any proposed configuration, and resolve active scopes, modes, thresholds, and path overrides. Scan the prepared merge tree against that target tip. Verify the prepared tracked tree before and after scanning. Run baseline and current measurements using the same isolated tool installation and effective policy.
5. Validate every enabled scanner's exit status and structured report, and verify that disabled scopes match the active configuration. Continue collecting outcomes when one scanner reports a regression. Missing or malformed output, missing required dependencies, parser failures, timeouts, and signals are operational failures. Advisory mode cannot hide those failures.
6. Re-read the live PR head, base reference, target branch tip, labels, and description. A stale head, retarget, or advanced target tip blocks with a rerun instruction. Apply the existing tested rationale parser to the current metadata.
7. Write the job summary and JSON evidence, upload artifacts with seven-day retention even on failures where the runner remains available, and finish with the policy verdict. Clean temporary source/tool directories when possible.

The action's repository CI runs its complete regression suite for each proposed release. Consumer runs verify their installed tool manifest and scanner availability, then run the checks. They do not rerun the tool's entire development test suite on every application PR. Test failures in the shared repository block release eligibility; consumer preparation and execution failures block the consuming PR.

### Result contract

The strict combined exit code is 0 when the active repository policy has no blocking regressions, 1 for a regression in ratchet mode, and 2 for an operational error in any enabled scan or report. Keep each scanner's measured regressions and effective modes visible even when they are advisory. Intentionally disabled scopes have an explicit disabled outcome rather than a fabricated successful scan. Any operational error takes precedence over regressions.

The final GitHub result can be clean, advisory, regression, accepted exception, invalid exception, or operational error. An all-advisory configuration uses the advisory outcome and clearly states that no blocking ratchets ran. A valid PR exception changes a blocking regression's final policy verdict, never the strict combined verdict or recorded findings. Label-without-rationale remains invalid even if every measured finding is advisory.

Every available report records schema and tool versions, scanner versions, head/target/tree identities, effective configuration identity, per-scanner language scope, strict outcomes, findings, advisory measurements, and final policy outcome. Include current rationale when an exception is active. Report missing evidence explicitly when preparation failed. Existing high advisory totals cannot become blocking findings through report validation.

Expose `outcome`, `strict-exit-code`, and `report-directory` action outputs for optional caller integration. These outputs do not turn a failed gate into success; do not recommend `continue-on-error` on the required job or action.

Summaries show locations, function identities, measurements, and duplicate partners without copying source snippets. Store artifacts in the consuming repository's Actions run. No external analysis service receives the source, and the action does not post repeated PR comments. Failure paths produce a useful summary when technically possible; checkout or runner failures may occur before the action can report.

## Trust and enforcement limits

Use ordinary read-only `pull_request` execution. Do not run untrusted project code with `pull_request_target`, inherit secrets, execute application lifecycle hooks, or load project lint configuration. Treat PR descriptions, filenames, refs, and configuration as data. Never interpolate them into executable shell text.

Keep scanner code and dependencies outside the source snapshot and resolve them from the pinned action release. A consuming PR cannot replace the checker by editing a local scanner script. It can still edit its caller workflow or propose future policy changes. Review of those changes and required-check settings remains part of repository governance.

Label/body reads and merge are not atomic. Requiring an up-to-date branch and rerunning on the listed events remain necessary. The action is not a GitHub App, merge authorization service, or protection against administrators changing repository rules.

Branch protection requires the observed check context from a successful hosted run and strict up-to-date enforcement. Verify the actual emitted name before changing settings; a step name alone is not a required-check context. Preserve unrelated protection and review rules. The action does not create labels or mutate branch protection itself.

## Local use from the same implementation

Ship a strict `quality-ratchet` command entrypoint in the shared source tree. Its default check accepts `--repo`, `--base`, and `--json`, and uses the same scanners, report schema, scope, and policy configuration. Strict means enforcing the configured modes without PR exceptions; configured advisories remain advisory. It does not expose exception flags. The diagnostic `report-test-debt` and `report-test-size` subcommands accept `--repo` and `--json` and retain their informational measurement semantics. The test-debt view may include non-JS/TS duplicate partners; the physical test-source inventory remains JS/TS. `explain-config` also accepts `--base` and displays the active policy and pending edits.

Document using a separate pinned tool checkout with its locked dependencies installed once. Agents invoke the command from that checkout against their application workspace. Consumer documentation or a small command alias can point to it; no scanner source is copied into the project. Windows and Linux local execution are part of v1 acceptance; hosted action execution initially supports GitHub-hosted Ubuntu runners.

An explicit local `--base` uses the merge base of that reference and HEAD, with existing prepared-merge handling preserved. Without it, use the locally available `refs/remotes/origin/HEAD` symbolic target. If unavailable, fail with a clear `--base` instruction. Do not silently assume `master` or fall back to a different branch. Local mode does not fetch automatically or claim it has checked the live remote target.

Local scans compare working-tree changes against the merge base. Hosted PR scans compare the prepared merge directly against the fetched target tip. Explain this distinction so agents can interpret differences caused by a target branch moving.

## Releases and maintenance

Publish semantic version tags and release notes describing rule, scope, identity-matching, scanner, and operational changes. Treat deliberate changes to shared default thresholds, default exclusions, existing configuration semantics, report schema, or accepted inputs as major-version changes. A repository changing its own valid settings does not require a shared release. Scanner upgrades and correctness fixes can change findings; call that out even for patch releases.

Recommend immutable full release commit SHAs with a version comment in consumer workflows. A convenience `v1` tag may exist, but the adoption template uses a release SHA. Pin nested actions to reviewed SHAs as well. Each release must use its own checked-in tool files, with no download of checker code from a moving branch.

Use GitHub Actions dependency updates for consumer upgrade PRs where configured. A rejected release can be rolled back by restoring the previous pin without copying code back. Pinning means fixes do not silently appear everywhere; it does not remove the maintenance benefit of implementing and testing the fix once.

Keep provenance and third-party license notices in the new repository. Review extracted Chronote and Perkcord checker/report sources and upstream dependencies before choosing the initial license and publishing code. Perkcord is currently private; permission to read it is not a substitute for checking publication rights and removing product-specific material. A root `LICENSE` was not available at the inspected Perkcord ref, so its publication terms remain an explicit provenance question. Public visibility is approved; relicensing is not implied. A provenance conflict blocks publication of the affected source and must be resolved explicitly.

## Adoption and migration

1. Extract and validate the shared tool from both repositories, retaining their behavior tests and adding isolation, broader-language duplication, diagnostic reporting, configuration, and packaging cases. Prepare the consumer workflow example and contributor documentation.
2. Publish a reviewed initial release after the approved implementation plan and release checks. Verify the public action can be resolved from a different owner.
3. Prepare explicit Chronote and Perkcord configurations preserving their inspected thresholds, modes, test coverage, and scanner scopes. Where repository policy differs from shared defaults, merge configuration-only preparation PRs under the existing gates before activating the shared action. This ensures the new action can load the intended policy from its target branch on its first enforced run. Do not add a bootstrap flag that trusts a PR's own relaxed settings.
4. Open a Chronote migration PR using the pinned release. Compare the shared tool with the existing gate on clean, regressed, and exempt examples. Keep existing enforcement active until the shared check is proven.
5. Remove superseded local scanners, scanner-only dependencies, tests, and workflow logic in the migration. Preserve unrelated lint, test, diagnostics, and deployment checks. Update local invocation instructions.
6. Reconcile required-check settings using observed hosted contexts. Do not leave the repository with a required check that no longer runs. If a temporary second check is needed, remove it only after the replacement is active and verified.
7. Open the Perkcord migration PR. Compare both existing and shared finding sets on representative web, bot, Convex, package, test, documentation, shell, and Terraform changes. Preserve commit-hook checks, generated-code handling, the advisory/report commands through thin shared-tool invocations, and the existing `format` job's unrelated checks. Update `application-ci`, main-push behavior, workflow contract tests, contributor instructions, and required checks as one reviewed transition. Retain legacy scc/Lizard metrics until a separate replacement decision. Remove copied scanner/report code and scanner-only dependencies only when this parity contract is satisfied.
8. Publish adoption instructions for the remaining portfolio. Further repository migrations are separate scoped changes, not automatic writes to every repository.

Initial work may be designed in this Chronote checkout because it contains the source implementation. On project creation, carry the approved design and subsequent plan into `BASIC-BIT/quality-ratchet` as their maintained home. Leave a pointer in the Chronote migration documentation rather than maintaining duplicate specifications.

## Validation required before release and migration completion

- Preserve both repositories' existing checker regression cases, including exact duplicate fingerprints, ignored/untracked paths, large eligible files, Markdown rationale boundaries, nested function and Convex object-handler identities, report validation, and tree mutation.
- Preserve Perkcord's language-specific duplication cases for Markdown layout and embedded JS/TS/shell, YAML literals, Python comments, and shell tokenization. Verify real scanner detection and unchanged-baseline behavior for each supported format in the two adoption repositories.
- Verify test-debt summary counts, stable hotspot ordering, overlapping-range caveats, source inventory, and non-failing oversized-test annotations. Verify large existing tests warn and pass, while newly enlarged offenders still fail the blocking gate.
- Compare all three reviewed Perkcord clone boundaries and representative changed/moved/new-copy cases against the shared behavior. Resolve differences explicitly before deleting the old boundary module.
- Verify clean, newly regressed, unchanged legacy, reduced legacy, renamed, deleted, and untracked-source examples in isolated fixture repositories.
- Verify default inheritance, schema validation, independent thresholds, format/path filters, path normalization, overlapping override order, array replacement, rename destinations, and reported effective settings. Cover both repositories' initial policy files and the illustrative configuration.
- Verify ratchet/advisory/off behavior, mixed per-path modes, an enabled override under a globally off check, all-advisory rollout, invalid all-off/empty coverage, diagnostic report dependencies, and disabled-report records. Advisory parser/tool failures must still block.
- Verify both trees use the same baseline configuration and that a PR changing thresholds, modes, scope, or overrides cannot weaken its own verdict. Cover missing/malformed active and proposed configuration, proposed deletion, config-only preparation followed by first adoption, and honest local `explain-config` output.
- Test a consumer with no installed application dependencies and one with incompatible project ESLint/TypeScript versions and lifecycle scripts that must never execute.
- Test local commands on Windows and Linux, explicit bases, default-branch discovery, and missing-history failures. Test the hosted composite package from a different GitHub owner.
- Exercise hosted label-without-rationale, accepted exception, push retaining the exception, rationale removal, label removal, and scanner failure while exempt. Obtain explicit authorization before applying exception labels to disposable probes. Close probes without merging.
- Verify clean and failing summaries, artifacts, action outputs, credential cleanup, and no mutation of the consumer checkout. Simulate a moved head, target advance, and retargeted PR.
- Run shared repository checks and a fresh review before the initial release. Inspect exact-head CI, reviews, mergeability, and actual required-check settings for both Chronote and Perkcord before claiming adoption complete. Preserve the existing 30-minute post-commit readiness requirement where it applies.
- Verify Perkcord's commit-hook path, `format` and `application-ci` aggregation, unchanged legacy metrics behavior, and post-merge CI after an accepted exception. Neither an aggregate check nor a deployment prerequisite may rerun and reject the already-accepted delta.

## Evidence and references

### Extraction source

- [Chronote implementation PR #415](https://github.com/Chronote-gg/Chronote/pull/415).
- Source merge commit: `53d5593904c0d220989506ae23e7fe39f21a0b37`.
- [Current contributor contract](https://github.com/Chronote-gg/Chronote/blob/53d5593904c0d220989506ae23e7fe39f21a0b37/docs/engineering/code-quality.md).
- [Original approved design](https://github.com/Chronote-gg/Chronote/blob/53d5593904c0d220989506ae23e7fe39f21a0b37/docs/superpowers/specs/2026-10-16-code-quality-ratchets-design.md).
- [Implementation acceptance evidence](https://github.com/Chronote-gg/Chronote/blob/53d5593904c0d220989506ae23e7fe39f21a0b37/docs/analysis/2026-10-16-code-quality-acceptance.md). This is the dated pre-final-audit checkpoint; final merge and rule activation were verified in the owning chat.
- Chronote's checked-in `LICENSE` identifies GNU Affero General Public License version 3. Preserve source attribution and verify upstream provenance during extraction.

### Perkcord comparison

Read-only native GitHub inspection verified the current `Perkcord/perkcord` default branch as `main`, at commit `6f4e39fa1204c434ed52746e4975e3b439f2bb3b`. The following references are pinned to that snapshot; recheck its current head before implementation.

- [Package scripts and scanner dependencies](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/package.json).
- [Complexity and size policy](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/docs/agentic/complexity-and-size-ratchets.md).
- [Duplication policy and approved boundaries](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/docs/agentic/duplication-ratchet.md).
- [Duplication engine and format normalization](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/scripts/dup-gate.mjs), [boundary records](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/scripts/dup-gate-boundaries.mjs), and [test-debt reporting](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/scripts/test-debt-report.mjs).
- [CI gate/advisory wiring and metrics job](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/.github/workflows/ci.yml), [commit hook](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/.husky/pre-commit), and [CI aggregation](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/scripts/ci-lane-gate.mjs).
- [Legacy metrics wrapper](https://github.com/Perkcord/perkcord/blob/6f4e39fa1204c434ed52746e4975e3b439f2bb3b/scripts/check-metrics.sh). [Lizard's upstream documentation](https://github.com/terryyin/lizard) distinguishes function length, warning formatting, and ignored-warning exit behavior.

This comparison inspected source and documented command wiring. It did not execute Perkcord's checks, verify its live branch rules, or prove migration parity. Those are implementation acceptance work.

### GitHub platform references

- [Composite action creation and action-directory access](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action).
- [Action metadata, inputs, outputs, and composite steps](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax).
- [Workflow reuse and access restrictions](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
- [Immutable workflow/action reference guidance](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).

Platform documentation was checked during this design. No public repository, action, release, consumer migration, label, or branch-protection change was created by this design document.
