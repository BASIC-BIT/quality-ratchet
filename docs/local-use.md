# Local use

Install the tool in its own checkout pinned to the reviewed release commit. Use Node 24.15.0 or a later Node 24 release and `npm ci --ignore-scripts`. Application dependencies are unnecessary. Keep the tool outside authored application source, or in the hard-excluded `.quality-ratchet-tool` directory.

## Commands

```sh
node /path/to/quality-ratchet/bin/quality-ratchet.mjs check --repo /path/to/app --base origin/main
node /path/to/quality-ratchet/bin/quality-ratchet.mjs explain-config --repo /path/to/app --base origin/main --json
node /path/to/quality-ratchet/bin/quality-ratchet.mjs report-test-size --repo /path/to/app --json
node /path/to/quality-ratchet/bin/quality-ratchet.mjs report-test-debt --repo /path/to/app --json
node /path/to/quality-ratchet/bin/quality-ratchet.mjs tool-manifest --json
```

In PowerShell, quote paths with spaces:

```powershell
node 'C:/tools/quality-ratchet/bin/quality-ratchet.mjs' check --repo 'D:/work/my app' --base origin/main --json
```

`check` is the default command. An omitted base resolves from the remote default branch when available. No command fetches automatically. Choose a fetched ref explicitly when that default is unavailable. Strict checks include eligible working-tree and untracked files. Their source identity is rechecked so intervening edits fail instead of producing a stale verdict.

Absolute diagnostics use committed HEAD policy and display pending configuration without applying it. They do not require a remote default branch. The tool manifest records runtime, dependency versions, lock hash and trusted asset hash. It describes installed identity, not completed hosted release qualification.

| Exit | Meaning                                                                  |
| ---- | ------------------------------------------------------------------------ |
| 0    | No blocking configured regressions, including advisory-only findings     |
| 1    | Blocking regressions                                                     |
| 2    | Setup, policy, parser, scanner, malformed report or stale-source failure |

The local strict command does not accept PR labels. The hosted adapter applies exception policy after preserving strict findings in its JSON evidence.

## Git EOL conversion

For selected local paths, fixed read-only Git metadata operations establish effective text/eol attributes, autocrlf and index provenance. One byte canonicalizer removes CR only before LF where Git conversion applies. Local comparison hashing and in-memory duplication identity share that projection. Raw scanner input, caller source/index/config and immutable hosted blobs stay exact. Authored EOL-only literal edits that Git preserves still have hunks and can block. See [release limits](releases.md#behavior-and-limits) for the unchanged split-literal tokenizer limitation.

## Tool development

```sh
npm ci --ignore-scripts
npm run check
node scripts/package-smoke.mjs
node bin/quality-ratchet.mjs check --base origin/main --json
```

The check script runs test, lint, format and schema/example validation. Test discovery enumerates only actual `*.test.mjs` under `test`, excluding fixture/helper trees. The smoke script installs only locked production dependencies in temporary storage, verifies native/parser availability, checks clean and duplicate source, and verifies saved operational-failure evidence. Development tests never run inside a consuming action.

## Installation and diagnostic details

The following setup pins published and qualified version 1.0.1 at release commit R3. See the [release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1) and [acceptance record](acceptance.md) for qualification evidence. Complete the consumer-specific acceptance steps in [adoption](adoption.md) before enabling enforcement. Keep optional dependencies enabled for jscpd's platform executable:

```text
git clone https://github.com/BASIC-BIT/quality-ratchet.git ../quality-ratchet-tool
git -C ../quality-ratchet-tool checkout --detach 0873869f6b8fd80150d24689849ec0aebd94e9dd # v1.0.1
npm --prefix ../quality-ratchet-tool ci --ignore-scripts --include=optional
```

An omitted strict-check base uses the local `origin/HEAD` symbolic reference. Missing history or an unavailable default requires an explicit base and otherwise exits 2. Repeated or unsupported flags also exit 2. The tool does not change Git configuration.

Enabled report failures, missing or contradictory scanner output, signals, timeouts and output overflow are operational errors. Child scanners have a 180-second ceiling and a 64 MiB output limit. Text output bounds finding and hotspot lists; JSON retains complete findings and inventory.

Test-size inventory uses JS/TS test/support files within global and file-size scopes, even when the file-size gate is off. Test-debt inventory uses duplication scope and reuses its current scan. These denominators can differ. Tests, stories, E2E support and fixture modules count when eligible. An unchanged oversized test may warn while the strict delta passes; a newly enlarged offender still fails.

Test-debt reports pair categories and up to 15 hotspots ordered by participating lines, occurrences and path. Clone ranges can overlap, so participating lines are not an estimate of removable lines. A successful absolute report does not establish a clean strict comparison.
