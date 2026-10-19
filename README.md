# Quality-ratchet

Check new or growing duplication, function complexity and file size against Git history. Each repository owns one JSON policy. Existing debt may remain or shrink.

Version 1.0.1 is [published](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1). It corrects local LF/CRLF comparison and JSX clone identity. The [workflow example](examples/code-quality.yml) pins its full release SHA. See [release notes](docs/releases.md) for behavior and limits, then follow [adoption](docs/adoption.md).

At the October 19, 2026 UTC snapshot, release qualification and post-merge source CI passed on Ubuntu and Windows with Node 24.15.0 and 24.21.0. Consumer policies have merged. [Chronote migration PR #421](https://github.com/Chronote-gg/Chronote/pull/421) remains open, and Perkcord is still in local qualification with no migration PR. Both keep existing default-branch enforcement. The [acceptance record](docs/acceptance.md) separates release evidence from pending consumer cutovers.

## Start locally

Use Node 24.15.0 or a newer Node 24 release. In a separate tool checkout:

```sh
npm ci --ignore-scripts
node bin/quality-ratchet.mjs check --repo /path/to/consumer --base origin/main
```

Fetch the intended baseline yourself before checking. The command does not fetch. It includes eligible working-tree and untracked files. See [local use](docs/local-use.md) for Windows commands, reports and exits.

Defaults are cyclomatic and cognitive complexity 15, fewer than 1,000 lines for new JS/TS files, and duplicate spans of at least 8 lines and 50 tokens. Tests, stories, fixtures, scripts and root configuration are included. Duplication supports [132 routeable formats](docs/supported-formats.md), including embedded code. Read the documented Markdown and normalization limits before adoption.

## Use in CI

Follow [adoption](docs/adoption.md). Stage the intended policy on the target branch first, then use the reviewed full release SHA in a read-only ordinary pull-request job. The action installs its own locked production dependencies without application lifecycle scripts. It requires no application installation or inherited secrets.

A PR cannot relax its own enforcement policy. The target policy applies to both trees; proposed policy edits are validated and displayed. A human-authorized `quality-exception` label plus nonempty text under `## Quality exception` accepts blocking regressions across pushes. It cannot accept setup, scanner, configuration or stale-result failures.

## Develop and release

`npm run check` runs actual test files, self-lint, formatting and schema/example validation. Only deliberately invalid or duplicated scanner fixtures are excluded from the repository's self-policy. Actual tests and tooling remain checked.

Read [configuration](docs/configuration.md), [releases](docs/releases.md), and the [acceptance record](docs/acceptance.md). The approved [design](docs/superpowers/specs/2026-10-16-quality-ratchet-design.md) and [plan](docs/superpowers/plans/2026-10-16-quality-ratchet.md) describe the migration requirements.

Source terms and attribution are in [provenance](docs/provenance.md), [NOTICE](NOTICE) and [LICENSE](LICENSE).
