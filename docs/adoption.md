# Prepare adoption of 1.0.1

The [workflow example](../examples/code-quality.yml) pins selected 1.0.1 publication target R2, `4ea131d30f161e07b4845fe64e55ae59fde31eab`. Hosted patch qualification and publication remain pending. Confirm both on the [v1.0.1 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1) and [acceptance record](acceptance.md) before activation. Chronote policy PR #419 and Perkcord policy PR #1153 have merged; migrations remain unmerged and neither replacement is active.

## Prepare the target branch

Inventory enforced scopes, thresholds, generated paths, test coverage, diagnostics, hooks and CI aggregation. Compare existing and shared outputs on immutable source and representative changes before removing copied checks. Keep detailed private-source results in the consumer's permitted evidence store; publish only sanitized counts and conclusions.

Commit the intended `quality-ratchet.json` in a configuration-only change under the old gates first. The shared action reads target policy even on its inaugural run. Preserve narrower existing scopes explicitly instead of silently broadening policy. Reconcile reviewed unchanged duplication boundaries and representative edits before removing any legacy allowance logic.

## Activate the action

Use an ordinary `pull_request` workflow for opened, synchronize, reopened, ready_for_review, edited, labeled and unlabeled events. Use no path filter. Grant only `contents: read` and `pull-requests: read`, check out the exact PR head with full history and `persist-credentials: false`, and pass the default GitHub token. No inherited secrets or application lifecycle commands are required.

The example sets PR concurrency cancellation, a job named `Code quality ratchet` and a 20-minute timeout. The action retains artifacts for seven days. Its inputs are only `github-token` and `repository-path`; policy remains in JSON. Outputs are `outcome`, `strict-exit-code` and `report-directory`. Available summary and JSON evidence are uploaded before the saved failure verdict returns.

The hosted action initially supports GitHub-hosted Ubuntu. Version 1.0.0 passed Windows/Linux qualification and disposable cross-owner execution. Version 1.0.1 has local Windows proof only; its hosted and minimum-Node qualification remain pending. Earlier runs do not qualify the patch or establish consumer migration acceptance.

## Exceptions and cutover

A human-authorized `quality-exception` label and nonempty rationale under the exact heading `## Quality exception` accept PR-wide blocking regressions across later pushes. The strict measurements remain in evidence. Missing rationale, stale head/base, invalid policy and scanner failures still block.

During migration, preserve unrelated lint, format, type, test, security, metrics and deployment checks. Update required-check settings only after observing actual hosted check names. Replace legacy gate calls in aggregate checks and hooks as one reviewed transition. Main-push or deployment prerequisites must not rerun and reject a delta already accepted by PR exception policy. Tool tests and unrelated main-push CI continue normally.

Retain existing enforcement until clean, regressed and accepted-exception runs prove the replacement. For a defective shared release, restore a previous compatible reviewed pin only if it covers the consumer's requirements. Published v1.0.0 retains the local CRLF defect corrected in 1.0.1. Reverse an incomplete cutover through a reviewed revert of its workflow, dependencies, copied checks and required context when no suitable pin exists. Keep unrelated branch rules, and prove the restored check before removing replacement enforcement. Record the exact pin, policy hash, hosted runs and unresolved limits in the consumer migration note.

Current-source comparison reconciled the reviewed Perkcord duplication boundaries. The dormant record remains dormant; unchanged and moved copies pass, while a new copy fails. Edited or newly copied active infrastructure boundaries also fail. Keep legacy enforcement until the full consumer cutover is accepted.

The human accepted the shared declaration exclusions for Perkcord. One authored `.d.mts` file therefore loses duplication coverage. All other parity checks and existing local metrics remain required before migration or legacy-check removal.

Configure GitHub Actions dependency-update PRs in each consumer where allowed. Updates are reviewed adoption decisions, not automatic rollout.
