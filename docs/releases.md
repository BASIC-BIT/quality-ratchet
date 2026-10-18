# Release 1.0.1, unpublished patch candidate

Version 1.0.1 corrects local LF/CRLF comparison and JSX clone identity. EOL-only checkout conversion no longer touches every source line, and structural LF/CRLF differences retain stable JSX endpoint identities. Genuine changed or added duplicates still block.

The correction protects string, template and raw tokens and quoted JSX attributes whose quote context is retained. An existing tokenizer limitation remains: an arbitrary scanner slice that starts and ends inside a quoted attribute can lose its surrounding quote context and treat literal EOL differences as insignificant. This patch does not claim literal preservation for every arbitrary slice.

Policy defaults, scopes, thresholds, schema, locked dependencies and exception semantics are unchanged. The source review approved the bounded correction. [Local regression proof](acceptance.md#patch-101-local-evidence) covers the unchanged LF/CRLF pair and genuine new duplication. Hosted/platform qualification, final source readiness, publication and consumer adoption remain separate pending work. Published v1.0.0 runs do not qualify this changed runtime.

## Patch source and publication selection

Reviewed source Q is `f8b11ee78a488f43ea910b17bf87899ea862559c`. Selected publication target R is `d93644e0744064841a3a5d734db372443a6bd0ef`. R contains the corrected runtime and safe adoption examples that pin Q as 1.0.1. This later documentation head E pins R in current examples and local instructions; E is not the tag target. A normal merge must preserve R for an immutable v1.0.1 tag after required readiness and qualification checks. Publication remains pending.

All 47 manifest assets plus action.yml are byte-for-byte and Git-blob identical at Q, R and this documentation follow-up. Recheck that identity before publication. Normal `node scripts/validate-examples.mjs --release` must pass. A passing pin/version contract alone does not establish hosted qualification or publication. Use the [v1.0.1 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1) for live publication status and the [acceptance record](acceptance.md) for actual qualification results.

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
