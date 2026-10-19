# Release 1.0.1

Version 1.0.1 was [published](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1) on October 18, 2026 at 23:57:06 UTC. Release qualification and post-merge source CI passed. Current examples pin the immutable release SHA. Consumer migrations remain pending at the October 19, 2026 UTC snapshot; see [adoption](adoption.md) for their status and cutover requirements.

Version 1.0.1 corrects local LF/CRLF comparison and JSX clone identity. Fixed read-only Git metadata operations establish effective text/eol attributes, autocrlf and index provenance for selected paths. One byte canonicalizer removes CR only before LF where Git conversion applies. Local comparison hashing and in-memory duplication identity share that projection.

Raw scanner input, caller source/index/config and immutable hosted blobs stay exact. Git-generated checkout EOL changes pass even when harmless comments touch old clones. Authored EOL-only literal changes that Git preserves retain real hunks and block, as do genuine content edits and new copies.

The scoped source and fixture reviews passed. Policy defaults, scopes, thresholds, schema, package/lock dependencies and exception semantics are unchanged. [Local regression proof](acceptance.md#patch-101-local-evidence) retains the same-runtime Q2 Windows 255-test result and seven real CLI cases. Q3 adds an explicit fixture conversion policy and a neutral 31-test result. The separate [final hosted qualification](acceptance.md#patch-101-publication-and-hosted-qualification) ran 255 tests with zero failures or skips in each Ubuntu/Windows and Node 24.15.0/24.21.0 combination. Historical v1.0.0 runs remain attributed to that release.

## Patch source and publication selection

The immutable v1.0.1 tag points to release commit R3. Its archive safely pins qualified source and fixture Q3 as 1.0.1. The later documentation head E3 pins R3 in current adoption examples and local setup. Normal integration preserved R3 and the E3 tree; neither the tag nor its archive was rewritten. Exact identities are recorded below.

The 48 manifest assets, action.yml and CI workflow are byte-for-byte and Git-blob identical across Q3/R3/E3. The integrated release validator, source manifest and clean-status checks passed. [Release check 39176654614](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39176654614) used the E3 workflow and checked out R3 in every candidate job. All four `node scripts/validate-examples.mjs --release` steps executed and passed after the locked install. [Final PR CI 39176656062](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39176656062) passed all six jobs at E3. [Post-merge source CI 39178578401](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39178578401) also passed at the integrated main commit. Earlier Ubuntu fixture setup failures remain historical and are superseded by this final qualification. See the [acceptance record](acceptance.md) for exact results and review limits.

## Behavior and limits

Context-free normalization retains string, template, raw and quoted-attribute distinctions when the tokenizer retains their context. A pre-existing arbitrary-slice limitation remains: a scanner slice that starts and ends inside a quoted attribute can lose the surrounding quote context and treat literal EOL differences as insignificant. This patch does not claim literal preservation for every arbitrary slice.

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

| Field                 | Published release evidence                                         |
| --------------------- | ------------------------------------------------------------------ |
| Reviewed source Q2    | `bb24eb0e00420cc0691c69590f4f06f63dccc60e`                         |
| Source and fixture Q3 | `b256189fa96e1a460609917a8a56383f793b4216`                         |
| Release commit R3     | `0873869f6b8fd80150d24689849ec0aebd94e9dd`                         |
| Version / schema      | 1.0.1 / 1                                                          |
| Hosted Node versions  | 24.15.0 / 24.21.0                                                  |
| Runtime asset hash    | `37bbe42c83c9a3a2ea0fa2a61ec7d2812aa336c35046d3835654bdfe7547a2ca` |
| Lock hash             | `b940d79a1aaf5f947e3e85516d3f05cd459be40fbc99fc67576a926913e1d804` |

Release ID is 416782245, published at `2026-10-18T23:57:06Z`, neither draft nor prerelease. Final documentation head E3 is `a70be518f65e23ea58ad66f255dc57711a4ac035`. PR #3 merged normally at `2026-10-18T23:56:32Z` into `07651cc73aeae00f0bc695875c10df8d6323a54b`. Its integrated tree, `1318053e0244a47ad8a85167dc561e9e46a20b6a`, equals E3's tree.

## Release 1.0.0 history

Version 1.0.0 introduced schema 1, the shared CLI and ordinary pull-request action. It was published on October 18, 2026 at 21:44:38 UTC, release ID 416730393, tag target `84f47115b726d962e73f6c3a06ba69b07cc38ccb`. Its tag and release remain unchanged. See the [v1.0.0 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.0).

Its qualified source was `9d713408d8c12eb9ced26fe45b4a99e1df5505ff`. All 47 trusted assets plus action.yml matched that release target. Ubuntu and Windows passed 223 tests on Node 24.15.0 and 24.21.0; production-only Linux smoke, own-PR/cross-owner action checks and authorized exception transitions passed. Exact [historical runs](acceptance.md#initial-release-qualification-october-18-2026) remain attributed to that source. They are not patch qualification.

The v1.0.0 runtime asset hash was `01aca099cfa27459b5a6c25d39f386aecd68a0e9dcbe21f0e93041c7da7a8168` and lock hash was `f7401eb223be14df24b406248c918248074476d6be0bb6372fe8bb6b496e9953`. It included literal-backslash path rejection and bounded parent warning publication, but retained the local LF/CRLF defect corrected in 1.0.1.
