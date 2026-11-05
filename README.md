# Quality-ratchet

Check new or growing duplication, function complexity and file size against Git history. Each repository owns one JSON policy. Existing debt may remain or shrink.

Version 1.1.0 is the latest published release. The hosted scan compares the pull-request head against the merge base of that head and the target branch instead of the target tip, so an unrelated merge into the target branch no longer discards a finished verdict, and a target-branch policy the branch has not taken is reported as an advisory warning rather than blocking. Action inputs, action outputs and the `outcome` values are unchanged; hosted evidence moves to `schemaVersion` 2. Scanner versions, policy defaults, scopes, thresholds, the policy JSON schema and exception behavior are unchanged. See [release notes](docs/releases.md) for its qualification and publication evidence.

[Release check 41897737237](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/41897737237) qualified commit `a0dfcca184fd83f0a23762f29353c7772c17906f`. All four Ubuntu/Windows lanes resolved it and passed 276 tests each with zero failures or skips, executed release-mode validation, and emitted the expected manifests. Linux production package smoke also passed. Version 1.1.0 is [published](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.1.0) at that commit. The [acceptance record](docs/acceptance.md) separates shared-tool qualification from consumer acceptance.

The [workflow example](examples/code-quality.yml) currently pins the [1.1.1 source candidate](docs/releases.md#111-candidate) for qualification. The [local setup](docs/local-use.md#installation-and-diagnostic-details) retains published v1.1.0. Qualify and publish the candidate, then verify its tag before consumer activation. Follow [adoption](docs/adoption.md) before changing consumer pins.

## Start locally

Use Node 24.22.1 or a newer Node 24 release. In a separate tool checkout:

```sh
npm ci --ignore-scripts
node bin/quality-ratchet.mjs check --repo /path/to/consumer --base origin/main
```

Fetch the intended baseline yourself before checking. The command does not fetch. It includes eligible working-tree and untracked files. See [local use](docs/local-use.md) for Windows commands, reports and exits.

Defaults are cyclomatic and cognitive complexity 15, fewer than 1,000 lines for new JS/TS files, and duplicate spans of at least 8 lines and 50 tokens. Tests, stories, fixtures, scripts and root configuration are included. Duplication supports [132 routeable formats](docs/supported-formats.md), including embedded code. Read the documented Markdown and normalization limits before adoption.

## Use in CI

Follow [adoption](docs/adoption.md). Stage the intended policy on the target branch, then use the reviewed full release SHA in a read-only ordinary pull-request job. Open branches must rebase or merge the target branch to pick that policy up. The action installs its own locked production dependencies without application lifecycle scripts. It requires no application installation or inherited secrets.

Hosted runs compare the PR head against the merge base of that head and the target branch, so unrelated merges into the target branch no longer invalidate a scan. In exchange the action no longer simulates merging the target tip into the head; [adoption](docs/adoption.md#activate-the-action) describes that trade-off and where the merge-base policy is read.

Enforcement policy is read from that merge base, not from the PR head tree, so a PR cannot relax its own enforcement; proposed policy edits are validated and displayed. When the policy at the merge base differs from the policy at the target tip, the run reports that in its summary and as a workflow warning annotation, and the outcome is unaffected: the branch adopts the target branch's current policy by rebasing or merging it. A human-authorized `quality-exception` label plus nonempty text under `## Quality exception` accepts blocking regressions across pushes. It cannot accept setup, scanner, configuration or stale-result failures.

## Develop and release

`npm run check` runs actual test files, self-lint, formatting and schema/example validation. Only deliberately invalid or duplicated scanner fixtures are excluded from the repository's self-policy. Actual tests and tooling remain checked.

Read [configuration](docs/configuration.md), [releases](docs/releases.md), and the [acceptance record](docs/acceptance.md). The approved [design](docs/superpowers/specs/2026-10-16-quality-ratchet-design.md) and [plan](docs/superpowers/plans/2026-10-16-quality-ratchet.md) describe the migration requirements.

Source terms and attribution are in [provenance](docs/provenance.md), [NOTICE](NOTICE) and [LICENSE](LICENSE).
