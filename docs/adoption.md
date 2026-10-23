# Adopt 1.0.2

Version 1.0.2 commit `84fa993cf93b9dedd4da19ecbad75bc8712d0874` passed [Release check 39927791916](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39927791916). The [workflow example](../examples/code-quality.yml) and [local checker setup](local-use.md#installation-and-diagnostic-details) pin this same qualified commit. Before consumer activation, use the [release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.2) for authoritative publication status and verify that v1.0.2 resolves to `84fa993cf93b9dedd4da19ecbad75bc8712d0874`. See [release notes](releases.md#candidate-identity-and-publication).

Use Node 24.22.1 or a newer Node 24 release for local checks. The hosted action supplies Node 24.22.1 itself. Keep consumer policy, enforced scopes, thresholds, coverage and exception rules unchanged. A local Node upgrade alone does not change the hosted action selected by an older SHA.

For an existing 1.0.1 consumer, update its action SHA/version comment, local checker checkout SHA and any recorded manifest asset/lock hashes together. Install from the new lockfile with lifecycle scripts disabled and optional dependencies retained. Verify strict quality and diagnostics on the consumer's actual current source, normal hooks, and hosted PR CI before integration. Record the exact accepted consumer head and main result. Do not use a quality exception or reduce coverage to make this pin update pass.

Release check passed all four 259-test Ubuntu/Windows lanes, their executed `--release` validators, and Linux production package smoke at the exact qualified commit. These shared-tool results do not establish consumer acceptance. The dated rollout and 1.0.1 qualification below remain historical. Follow the preparation and cutover requirements when changing an existing gate.

## Historical rollout snapshot, October 19, 2026 UTC

Chronote policy PR #419 and Perkcord policy PR #1153 have merged, and the actual policies were verified. [Chronote migration PR #421](https://github.com/Chronote-gg/Chronote/pull/421) is open and unmerged, with CI and review in progress. Perkcord remains in local qualification; no migration PR exists yet. Both keep existing default-branch enforcement. Perkcord required-context activation remains unapproved.

Comparisons at the final release pin verified the reviewed duplication boundaries and matching debt/size reports in private evidence. Normal commit hooks, checks of each consumer's entire current tree and hosted migration acceptance remain pending. Each consumer must record its exact accepted head, merge, settings readback and main-push result at cutover. This dated snapshot does not claim product deployment or runtime verification.

## Prepare the target branch

Inventory enforced scopes, thresholds, generated paths, test coverage, diagnostics, hooks and CI aggregation. Compare existing and shared outputs on immutable source and representative changes before removing copied checks. Keep detailed private-source results in the consumer's permitted evidence store; publish only sanitized counts and conclusions.

Commit the intended `quality-ratchet.json` in a configuration-only change under the old gates first. The shared action reads target policy even on its inaugural run. Preserve narrower existing scopes explicitly instead of silently broadening policy. Reconcile reviewed unchanged duplication boundaries and representative edits before removing any legacy allowance logic.

## Activate the action

Use an ordinary `pull_request` workflow for opened, synchronize, reopened, ready_for_review, edited, labeled and unlabeled events. Use no path filter. Grant only `contents: read` and `pull-requests: read`, check out the exact PR head with full history and `persist-credentials: false`, and pass the default GitHub token. No inherited secrets or application lifecycle commands are required.

The example sets PR concurrency cancellation, a job named `Code quality ratchet` and a 20-minute timeout. The action retains artifacts for seven days. Its inputs are only `github-token` and `repository-path`; policy remains in JSON. Outputs are `outcome`, `strict-exit-code` and `report-directory`. Available summary and JSON evidence are uploaded before the saved failure verdict returns.

The hosted action initially supports GitHub-hosted Ubuntu. Version 1.0.1 passed release qualification and final PR CI on Ubuntu and Windows with Node 24.15.0 and 24.21.0. Each combination ran 255 tests with zero failures or skips, and both workflows passed the Linux production-only package smoke. Post-merge source CI also passed. Version 1.0.0 disposable cross-owner execution remains historical evidence. These shared-tool results do not establish consumer migration acceptance.

## Exceptions and cutover

A human-authorized `quality-exception` label and nonempty rationale under the exact heading `## Quality exception` accept PR-wide blocking regressions across later pushes. The strict measurements remain in evidence. Missing rationale, stale head/base, invalid policy and scanner failures still block.

During migration, preserve unrelated lint, format, type, test, security, metrics and deployment checks. Update required-check settings only after observing actual hosted check names. Replace legacy gate calls in aggregate checks and hooks as one reviewed transition. Main-push or deployment prerequisites must not rerun and reject a delta already accepted by PR exception policy. Tool tests and unrelated main-push CI continue normally.

Retain existing enforcement until clean, regressed and accepted-exception runs prove the replacement. For a defective shared release, restore a previous compatible reviewed pin only if it covers the consumer's requirements. Published v1.0.0 retains the local CRLF defect corrected in 1.0.1. Reverse an incomplete cutover through a reviewed revert to its prior workflow, dependencies, checker code and required context when no suitable pin exists. Keep unrelated branch rules, and prove the restored check before removing replacement enforcement. Record the exact pin, policy hash, hosted runs and unresolved limits in the consumer migration note.

Current-source comparison reconciled the reviewed Perkcord duplication boundaries. The dormant record remains dormant; unchanged and moved copies pass, while a new copy fails. Edited or newly copied active infrastructure boundaries also fail. Keep legacy enforcement until the full consumer cutover is accepted.

The human accepted the shared declaration exclusions for Perkcord. One authored `.d.mts` file therefore loses duplication coverage. This is the only accepted coverage loss. All other parity checks, local hooks, reports, metrics, CI aggregation and exception behavior remain required before migration or legacy-check removal.

Configure GitHub Actions dependency-update PRs in each consumer where allowed. Updates are reviewed adoption decisions, not automatic rollout.
