# Release 1.0.1, unpublished patch candidate

Version 1.0.1 corrects local LF/CRLF comparison and JSX clone identity. EOL-only checkout conversion no longer touches every source line, and structural LF/CRLF differences retain stable JSX endpoint identities. Genuine changed or added duplicates still block.

Local endpoint identity now accounts for Git EOL conversion using read-only effective text/eol metadata and core.autocrlf. One byte-preserving canonicalizer projects only paths Git would normalize, for local comparison hash input and in-memory endpoint identity. Source snapshots, scanner inputs and working-source mutation hashes keep exact bytes. Authored EOL changes have real hunks when Git preserves them; hosted comparisons retain immutable Git blob bytes. Committed/hosted blobs and context-free normalization retain authored literal distinctions. The correction protects string, template and raw tokens and quoted JSX attributes whose quote context is retained. An existing tokenizer limitation remains: an arbitrary scanner slice that starts and ends inside a quoted attribute can lose its surrounding quote context and treat literal EOL differences as insignificant. This patch does not claim literal preservation for every arbitrary slice.

Policy defaults, scopes, thresholds, schema, locked dependencies and exception semantics are unchanged. Configured review required this follow-up for multiline quoted JSX attributes and release workflow validation. The follow-up needs fresh review and qualification. [Local regression proof](acceptance.md#patch-101-local-evidence) covers the unchanged LF/CRLF pair and genuine new duplication. Hosted/platform qualification, final source readiness, publication and consumer adoption remain separate pending work. Published v1.0.0 runs do not qualify this changed runtime.

## Patch source and publication selection

The previous source Q was `f8b11ee78a488f43ea910b17bf87899ea862559c`, and the superseded publication target R was `d93644e0744064841a3a5d734db372443a6bd0ef`. Neither qualifies the follow-up runtime. Do not tag or adopt the superseded target. Existing example pins remain unchanged during source correction; a new reviewed source and publication/docs sequence must be selected after qualification. Version 1.0.1 remains unpublished.

Final release validation must match the adoption template version to the package and retain a full immutable SHA. The reusable CI checks now run that validation when invoked with a release candidate, using their existing dependency installation. Ordinary candidate checks remain available without release mode. A passing version/pin contract does not establish hosted qualification or publication.

## Behavior and limits

The shared tool retains Git-relative growth rules, tests in enforced scope, lexical complexity identities and 132 routeable duplication formats. It preserves embedded-language detections and reports prose-only Markdown omissions. Source suppression markers fail operationally. Unsupported normalization grammars use conservative raw identities, which can produce additional findings after whitespace or comment changes.

Policy lives in one validated JSON file. Strict exits are 0, 1 and 2. Advisory findings remain visible; operational errors still block. Proposed policy cannot relax its own PR. There is no source allowance registry or warning-only strict flag. Consumer-specific scopes, hook wiring and already-reviewed boundaries need separate migration evidence.

## Qualification and publication

The manual `Release check` workflow accepts a candidate ref and prints its resolved commit and tool manifest. Use a full SHA for reproducible qualification; a tag is resolved independently by each job and their recorded SHAs must agree. It runs checks and the package smoke with read-only permissions. It neither publishes nor substitutes for PR, exception or source review evidence.

## Pins and maintenance

The manifest hashes raw runtime asset bytes and verifies the isolated copy against its source on the same machine. Checkout line-ending conversion can change that hash for one Git commit. This repository declares LF text checkout to keep its assets consistent; retain the observed platform manifest with each qualification record. Use the full Git SHA as the portable release identity.

The adoption template uses a full immutable SHA and a `# v1.0.1` comment. No mutable major-version tag is planned. Rollback requires a compatible reviewed pin or a reviewed cutover revert. See [adoption](adoption.md) for the v1.0.0 CRLF caveat.

Current reviewed nested pins:

| Action                  | Version | Full SHA                                   |
| ----------------------- | ------- | ------------------------------------------ |
| actions/checkout        | v7.0.1  | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node      | v7.1.0  | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/upload-artifact | v7.0.2  | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Dependabot checks this repository's GitHub Actions weekly. Consumers must configure their own update PRs where permitted; this repository does not schedule their upgrades.

Changes to shared default thresholds/exclusions, existing configuration semantics, report schema or accepted inputs require a major version. Scanner updates and correctness fixes can change findings even in patch releases, so release notes must explain them. Repository-local policy edits do not require a shared release. Preserve provenance and notices on every release.

## Patch runtime identity

| Field                   | Local candidate value                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Reviewed source Q       | `f8b11ee78a488f43ea910b17bf87899ea862559c`                         |
| Publication target R    | `d93644e0744064841a3a5d734db372443a6bd0ef`                         |
| Version / schema        | 1.0.1 / 1                                                          |
| Observed / minimum Node | 24.18.0 / 24.15.0                                                  |
| Runtime asset hash      | `be45b1c9ad11318dfb6ffe0ba03cac4723f87ff15c2b467de5ebfd89597c817b` |
| Lock hash               | `b940d79a1aaf5f947e3e85516d3f05cd459be40fbc99fc67576a926913e1d804` |

## Release 1.0.0 history

Version 1.0.0 introduced schema 1, the shared CLI and ordinary pull-request action. It was published on October 18, 2026 at 21:44:38 UTC, release ID 416730393, tag target `84f47115b726d962e73f6c3a06ba69b07cc38ccb`. Its tag and release remain unchanged. See the [v1.0.0 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.0).

Its qualified source was `9d713408d8c12eb9ced26fe45b4a99e1df5505ff`. All 47 trusted assets plus action.yml matched that release target. Ubuntu and Windows passed 223 tests on Node 24.15.0 and 24.21.0; production-only Linux smoke, own-PR/cross-owner action checks and authorized exception transitions passed. Exact [historical runs](acceptance.md#initial-release-qualification-october-18-2026) remain attributed to that source. They are not patch qualification.

The v1.0.0 runtime asset hash was `01aca099cfa27459b5a6c25d39f386aecd68a0e9dcbe21f0e93041c7da7a8168` and lock hash was `f7401eb223be14df24b406248c918248074476d6be0bb6372fe8bb6b496e9953`. It included literal-backslash path rejection and bounded parent warning publication, but retained the local LF/CRLF defect corrected in 1.0.1.
