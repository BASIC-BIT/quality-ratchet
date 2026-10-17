# Adopt a qualified release

The [workflow example](../examples/code-quality.yml) pins qualified runtime `ba9c9bec7c312a303e61b6779591610cd32509b8` for v1.0.0. Publication still requires source integration and the tag/release at that commit. Begin enforcement only after publication and the consumer preparation below. Chronote and Perkcord remain unmigrated, with no policies staged; this documentation does not authorize activation.

## Prepare the target branch

Inventory enforced scopes, thresholds, generated paths, test coverage, diagnostics, hooks and CI aggregation. Compare existing and shared outputs on immutable source and representative changes before removing copied checks. Keep detailed private-source results in the consumer's permitted evidence store; publish only sanitized counts and conclusions.

Commit the intended `quality-ratchet.json` in a configuration-only change under the old gates first. The shared action reads target policy even on its inaugural run. Preserve narrower existing scopes explicitly instead of silently broadening policy. Reconcile reviewed unchanged duplication boundaries and representative edits before removing any legacy allowance logic.

## Activate the action

Use an ordinary `pull_request` workflow for opened, synchronize, reopened, ready_for_review, edited, labeled and unlabeled events. Use no path filter. Grant only `contents: read` and `pull-requests: read`, check out the exact PR head with full history and `persist-credentials: false`, and pass the default GitHub token. No inherited secrets or application lifecycle commands are required.

The example sets PR concurrency cancellation, a job named `Code quality ratchet` and a 20-minute timeout. The action retains artifacts for seven days. Its inputs are only `github-token` and `repository-path`; policy remains in JSON. Outputs are `outcome`, `strict-exit-code` and `report-directory`. Available summary and JSON evidence are uploaded before the saved failure verdict returns.

The hosted action initially supports GitHub-hosted Ubuntu. Local CLI qualification covers Windows and Linux. The qualified runtime passed cross-owner execution in a disposable, unmerged PR. This proves action resolution and execution, not consumer policy or migration acceptance.

## Exceptions and cutover

A human-authorized `quality-exception` label and nonempty rationale under the exact heading `## Quality exception` accept PR-wide blocking regressions across later pushes. The strict measurements remain in evidence. Missing rationale, stale head/base, invalid policy and scanner failures still block.

During migration, preserve unrelated lint, format, type, test, security, metrics and deployment checks. Update required-check settings only after observing actual hosted check names. Replace legacy gate calls in aggregate checks and hooks as one reviewed transition. Main-push or deployment prerequisites must not rerun and reject a delta already accepted by PR exception policy. Tool tests and unrelated main-push CI continue normally.

Retain existing enforcement until clean, regressed and accepted-exception runs prove the replacement. For a later defective shared release, restore the previous compatible reviewed pin. This initial release has no predecessor, so reverse an incomplete cutover through a reviewed revert of its workflow, dependencies, copied checks and required context. Keep unrelated branch rules, and prove the restored check before removing replacement enforcement. Record the exact pin, policy hash, hosted runs and unresolved limits in the consumer migration note.

The Perkcord runtime duplication boundary remains UNKNOWN until Task 10 refreshes and reconciles current source. Keep the legacy allowance logic until that comparison is accepted.

Configure GitHub Actions dependency-update PRs in each consumer where allowed. Updates are reviewed adoption decisions, not automatic rollout.
