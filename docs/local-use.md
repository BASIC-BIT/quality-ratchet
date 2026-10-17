# Local use

Keep a separate checkout of this tool pinned to your approved release commit. The consumer keeps its `quality-ratchet.json` policy and a command alias. It does not need scanner source or installed application dependencies.

## Install the pinned tool

Use Node 24.15.0 or later within Node 24. Replace the example directory and commit with your chosen local installation and approved full commit SHA.

```text
git clone https://github.com/BASIC-BIT/quality-ratchet.git ../quality-ratchet-tool
git -C ../quality-ratchet-tool checkout --detach <approved-full-commit-sha>
npm --prefix ../quality-ratchet-tool ci --ignore-scripts
```

Keep optional dependencies enabled because jscpd ships its native executable through a platform package. This installs the tool's lockfile. It does not run consumer lifecycle scripts or load consumer ESLint configuration.

For a tool checkout beside the consumer, add one package command:

```json
"quality:check": "node ../quality-ratchet-tool/bin/quality-ratchet.mjs --repo ."
```

Run `npm run quality:check -- --base origin/main` in the consumer. The command is always strict. It includes tracked working changes and eligible untracked files.

## Commands and policy source

| Command                   | Supported options                         | Policy used                       |
| ------------------------- | ----------------------------------------- | --------------------------------- |
| Default check, or `check` | `--repo <root>`, `--base <ref>`, `--json` | Comparison baseline commit        |
| `explain-config`          | `--repo <root>`, `--base <ref>`, `--json` | Same baseline as the strict check |
| `report-test-debt`        | `--repo <root>`, `--json`                 | Committed `HEAD`                  |
| `report-test-size`        | `--repo <root>`, `--json`                 | Committed `HEAD`                  |

When `--base` is omitted from check or explain-config, the tool uses the local `origin/HEAD` symbolic reference. If it is missing, pass `--base <ref>` explicitly. The tool does not fetch history or change Git configuration. Missing or invalid history fails with exit 2.

Both revisions of a strict comparison use the baseline policy. A proposed working-copy policy must validate and appears in the output, but cannot relax its own comparison. `explain-config` shows resolved defaults, active settings, proposed differences, and current enabled coverage. Paths excluded by scope are outside that coverage. With no config file, tool defaults apply.

Absolute diagnostic commands use committed `HEAD` policy to describe current source. They work without `origin/HEAD`, accept no `--base`, and validate and show proposed working configuration without applying it. Their output identifies the policy commit and hash. A successful diagnostic is not a successful strict check.

```text
node ../quality-ratchet-tool/bin/quality-ratchet.mjs --repo . --base origin/main --json
node ../quality-ratchet-tool/bin/quality-ratchet.mjs explain-config --repo . --base origin/main
node ../quality-ratchet-tool/bin/quality-ratchet.mjs report-test-debt --repo .
node ../quality-ratchet-tool/bin/quality-ratchet.mjs report-test-size --repo . --json
```

Unsupported or repeated flags fail with exit 2. Modes, thresholds, scopes, and report settings belong only in `quality-ratchet.json`. There is no warn-only flag or command-line policy override.

## Results and diagnostics

The strict check collects all three scanner outcomes. Exit 0 means no blocking configured regression, exit 1 means at least one ratchet-mode regression, and exit 2 means an operational or configuration failure. Advisory-mode regressions remain visible with exit 0, while advisory scanner or enabled report failures still produce exit 2. All-advisory coverage is valid and explicitly has zero blocking files. All-off policy or wholly empty actual enabled coverage fails.

Disabled scanners and reports have explicit disabled records. Missing scanner output, invalid JSON, wrong baseline or policy identity, contradictory measured exit codes, signals, timeouts, and output overflow fail operationally. Child processes have a 180-second ceiling and 64 MiB output limit. Text output bounds finding and hotspot lists; JSON retains complete findings and inventory.

The test-size view counts JS/TS test and support files within active global and file-size scopes, even when that check is off. Its threshold is `reports.testSize.oversizedLines`, default 1,000 physical lines. The test-debt view reuses the complete current duplication scan and applies duplication scope to its JS/TS test-source inventory. These inventories can differ when scanner scopes differ. Tests, stories, E2E support and fixture modules count; excluded or unsupported files do not.

Absolute size and duplicate totals are informational. Oversized existing tests may warn while a clean delta passes; a new or growing file may independently fail the file-size ratchet. The debt view reports pair categories and up to 15 hotspots ordered by participating lines, occurrences, then path. Clone ranges can overlap, so participating lines are not removable-line estimates. See [supported formats](supported-formats.md) for native scanner limits, including Markdown prose coverage.

No GitHub Action or hosted exception evaluation is provided by these local commands. Hosted integration and platform qualification are separate implementation tasks.
