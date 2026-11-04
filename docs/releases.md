# Release 1.1.0

Version 1.1.0 contains the hosted merge-base comparison merged in [PR #8](https://github.com/BASIC-BIT/quality-ratchet/pull/8) and the advisory policy-divergence report merged in [PR #9](https://github.com/BASIC-BIT/quality-ratchet/pull/9). Both change hosted behavior, so this is a minor release rather than a patch. It keeps the 1.0.2 Node `>=24.22.1 <25` floor and 24.22.1 action pin, and the 1.0.1 LF/CRLF and JSX corrections with their documented limits.

No scanner version, dependency version, policy default, threshold, scope, policy JSON schema or exception semantic changes. Action inputs, action outputs and the `outcome` value set are unchanged, and strict exits remain 0, 1 and 2. Package and lockfile changes only set the release version to 1.1.0. LICENSE, NOTICE and [publication provenance](provenance.md) remain unchanged. Hosted evidence moves from `schemaVersion` 1 to 2; that, the nullable fields recorded below, the new `::warning` annotations and the new end-of-run verdict line are what a consumer adopting from 1.0.2 must read.

## Candidate identity and publication

The reviewed heads are `e9b9dae214391b31d3c4ef6814aaaa84124ea961` for PR #8 and `da7af3c6f501dad2608b3d7f254bde3b89faf59e` for PR #9. Main merged them at `d5adbb92a973fc579d4f1de5f0bd3967d5366b30` and `80b26a0102f22bba268042bd7065b862d5fd8fff`, and each merge carries the tree of the head it integrated, `02af9ac21fd418e7214a18e5d89fdf99786e0f28` and `1b8009a5c12d72a6bbfeeaed0f23a0507078cad4`. [PR CI 41795825856](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/41795825856) and [PR CI 41840194612](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/41840194612) passed at those heads. [Source CI 41859591829](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/41859591829) passed all four 276-test platform jobs and the Linux production package smoke at the integrated main commit on Node 24.22.1/npm 11.19.1. That source CI did not exercise the manual candidate-only release validator. [PR CI 41871528387](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/41871528387) then passed at release candidate R itself.

R's immutable archive pins versioned source `39ff1c1920c188264c5ca0a8d45df4a04afdf723` as v1.1.0 to avoid a self-referential commit hash. That intermediate commit supplies R's identical runtime assets, action and qualification workflow; it is an identity anchor, not the release qualification target. R adds only release and adoption metadata on top of it. Never dispatch `Release check` against the anchor: at that commit the package already reads 1.1.0 while [the workflow example](../examples/code-quality.yml) still carries its `# v1.0.2` comment, so the adoption-pin assertion in `test/action.test.mjs` fails there and `npm run check` fails with it. Those red lanes are how the anchor is built, not a defect in the release, and the only dispatch target was the integrated candidate commit.

[Release check 41897737237](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/41897737237) qualified release candidate R, `a0dfcca184fd83f0a23762f29353c7772c17906f`, with tree `84b2907b9eb11c51d594fd3d75ff489714121e06`. It ran as `workflow_dispatch` attempt 1 from `main`, dispatched at `2026-11-04T19:31:23Z` and completed at `2026-11-04T19:42:53Z`. All four Ubuntu/Windows minimum/floating Node lanes resolved R and passed 276 tests each with zero failures or skips, on Node 24.22.1 for the pinned-minimum lanes and 24.22.2 for the floating Node 24 lanes. The `--release` validation executed and reported "Schema, policy examples, package versions and adoption template valid." Linux production package smoke passed at R, and its manifests reported asset hash `33a1a071daa4722de2ffbe9402c2c1b637db58f0c37df6fb2207d697994356b9` and lock hash `11e99149474bcd759c6753ae22a8a3a63fd02daf1f0e99a409a28f25967101c4`. The `Code quality ratchet` job skipped by design on a non-pull-request event. The workflow is read-only and did not publish.

R reached `main` through merge commit `330f27a270c772e585dfc278ec2d197c8f2a5b57`, which preserves the identity anchor in `main`'s history as integration required: both the workflow example and the local setup referenced that anchor by full SHA, and a squash or rebase integration would have left those pins addressing a commit outside `main`'s history without reporting any error. R's tree differs from the anchor's `d192c08bde8fb9600d3c5b9efdfa340445330eb4` because R adds documentation only; the runtime assets are identical.

Version 1.1.0 is [published](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.1.0) at R, release ID 434372332, published at `2026-11-04T19:45:14Z`, neither draft nor prerelease, and now the latest release. Immutable tag `v1.1.0` resolves to R; verify that before adopting this version. This repository's tags are exactly v1.0.0, v1.0.1, v1.0.2 and v1.1.0: no existing release tag moved, and no mutable major-version tag exists.

Current examples and [local setup](local-use.md#installation-and-diagnostic-details) pin R as v1.1.0; later documentation commits do not alter R, its archive or its runtime assets. Consumers must adopt that same full SHA explicitly in both their hosted action and local checker; release publication alone does not update either. Shared-tool qualification and publication do not establish consumer acceptance. The 1.0.2 and earlier evidence below remains historical and applies only to its recorded source. Consumer rollout status remains in its dated record rather than being inferred from shared-tool CI.

## Merge-base comparison and staleness

The hosted scan compares the pull-request head against the merge base of that head and the target branch, and scans the head's own tree. Released 1.0.2 compared against the target branch tip and scanned the simulated merge of that tip into the head. A merge base does not move when unrelated changes merge into the target branch, so a finished scan stays valid under merge pressure: 1.0.2 discarded a completed verdict as `stale` whenever the target branch moved during a scan, which made any scan longer than the interval between merges to the target unpassable.

The post-scan staleness check compares that same merge base. `stale` is reported for a changed head, a retarget or a moved merge base, and its message says so. The deliberate cost is that a regression appearing only once newly merged target code is combined with the branch is not reported until the branch merges or rebases the target branch; check that combination locally with an in-progress merge, which the local checker compares against its exact target parent. Enforcement policy is read from the same merge base, so a pull request still cannot relax its own enforcement, and a policy change staged on the target branch does not apply retroactively to an open branch.

The post-scan baseline read is fetched under its own refs and separates a branch-state change from transport flake. A target branch force-pushed to unrelated history under the same name delivers its refs and has no merge base; that is reported `stale` rather than as a failed read, and no rerun clears it, because preparation then finds no merge base and the run reports `error` with exit code 2 until the branch is repaired. A delivery failure is retried once after a one-second delay; a second failure keeps the completed report and returns its own `error` message naming that read, which is rerunnable.

The action prints a one-line verdict at the end of a run, `Quality ratchet outcome: <outcome> - <message>`, on stdout when the exit code is 0 and on stderr otherwise, with control characters replaced, a 500-character limit per part and stated truncation. Released 1.0.2 printed nothing at that step and only set the exit code, so this is new log output rather than a changed line. It is deliberately emitted behind a fixed prefix on one line so a saved message cannot forge a workflow command; do not parse it as a stable contract, because evidence is the contract.

## Advisory policy divergence reporting

The action reports a policy divergence: the policy at the pull request's merge base differs from the policy at the target tip, so the enforced policy is not the target branch's current one. The report is advisory. There is no new `outcome` value and no new exit code; the run records a line in the job summary and publishes a workflow `::warning` annotation, and the verdict remains whatever the scan measured. Released 1.0.2 compared against the target tip itself, so that case surfaced there as `stale`; under the merge-base comparison in this release it would otherwise be invisible, because a target-branch policy change moves neither the head nor the merge base. Consumers that branch on the `outcome` output, or that rerun automatically on `stale`, need no change. A consumer that wants a divergence to block must enforce that itself from the evidence hashes recorded below: the shared action does not, because the hash covers the whole resolved policy, so blocking would fail every open pull request on any target-branch policy edit, relaxations included.

The compared target-tip policy is the one read after the scan, so a policy change merged into the target branch while a scan runs is still reported. When that post-scan read resolves no policy, the tip observed while scanning is compared instead, so a target tip already seen to diverge is still reported after it takes a configuration this tool rejects. Only when neither tip resolves is the target policy unknown and no divergence reported for that run. That condition is itself recorded in the job summary and published as a workflow `::warning` annotation, so a run that could not compare policies is visible without opening the summary.

## Hosted evidence schema 2

Hosted evidence is `schemaVersion` 2. That is a change for anyone adopting from released 1.0.2, which emits version 1: `scanned.baseSha` changed meaning from the target tip to the merge base, so the version moved even though the key did not.

Version 2 records both revisions and both policies. `scanned.baseSha` is the compared merge base and `scanned.baseTipSha` the target tip observed while scanning; `scanned.policyHash` is the enforced merge-base policy and `scanned.baseTipPolicyHash` that tip's policy, `null` when the tip's configuration did not resolve. The live record adds `current.baseTipSha`, the tip read after the scan, `current.baseTipPolicyHash`, the policy the divergence report compared, and `current.baseTipPolicyUnreadable`, true when that tip's configuration did not resolve.

One existing field changed type rather than being added. `current.baseSha` is now `string | null`, where a non-null `current` record previously always carried a full object SHA. It is `null` when the pull request was retargeted and when the target branch was force-pushed to unrelated history, both reported `stale`, and the new `current.baseTipSha` is `null` in those same two cases. A consumer that reads `evidence.current.baseSha` as a SHA must accept `null`. A reader that rejects unknown keys must stop: further additive fields can appear under this `schemaVersion`. The `QualityReport` wrapped as `quality` and the policy JSON schema in `schema/` are unrelated to this number and are unchanged.

## Release 1.0.2 history

Version 1.0.2 contains the Node security maintenance merged in [PR #5](https://github.com/BASIC-BIT/quality-ratchet/pull/5). It requires Node `>=24.22.1 <25`, pins the action to Node 24.22.1, rejects unsupported local runtimes before checking source, and sets `check-latest` for the floating Node 24 CI lane. It is a security patch with no scanner, dependency version, policy, threshold, scope, schema or exception changes; its package and lockfile changes only set the release version to 1.0.2.

The reviewed source head is `ed571d40b471c9ca34f82cf2bea5d85520408e12`. Main merged it at `29686861c96025dc74061ab2494c40d85c7e6cb5`; both have tree `4f6080c07f2fec8043d0e673e8dcd3ab332312df`. [Source CI 39865414504](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39865414504) passed all four 259-test platform jobs and the Linux production package smoke on Node 24.22.1/npm 11.19.1. [Release check 39927791916](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39927791916) qualified release candidate R, `84fa993cf93b9dedd4da19ecbad75bc8712d0874`, with tree `7073adbb9ee8d9ca468b25550484a9c623406621`. All four Ubuntu/Windows minimum/floating Node lanes resolved R, passed 259 tests each, executed `--release` validation and emitted the expected manifests. Linux production package smoke passed at R. The non-PR quality job skipped by design.

R's immutable archive pins versioned source `4dd0e2056b6e7b36cb805dc75421fbe32e811a54` as v1.0.2 to avoid a self-referential commit hash. That intermediate commit supplied R's identical runtime assets, action and qualification workflow; it was an identity anchor, not the release target. Immutable tag `v1.0.2` points to R. Use the [v1.0.2 release page](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.2) for authoritative publication status and verify that its tag resolves to `84fa993cf93b9dedd4da19ecbad75bc8712d0874` before adopting that version. Examples and local setup now pin published 1.1.0 instead; a 1.0.2 consumer keeps its own recorded pin until it accepts 1.1.0.

## Release 1.0.1 history

Version 1.0.1 was [published](https://github.com/BASIC-BIT/quality-ratchet/releases/tag/v1.0.1) on October 18, 2026 at 23:57:06 UTC. Release qualification and post-merge source CI passed. At that publication, examples pinned the immutable release SHA. Consumer migrations remained pending at the October 19, 2026 UTC snapshot; see [adoption](adoption.md) for their status and cutover requirements.

Version 1.0.1 corrects local LF/CRLF comparison and JSX clone identity. Fixed read-only Git metadata operations establish effective text/eol attributes, autocrlf and index provenance for selected paths. One byte canonicalizer removes CR only before LF where Git conversion applies. Local comparison hashing and in-memory duplication identity share that projection.

Raw scanner input, caller source/index/config and immutable hosted blobs stay exact. Git-generated checkout EOL changes pass even when harmless comments touch old clones. Authored EOL-only literal changes that Git preserves retain real hunks and block, as do genuine content edits and new copies.

The scoped source and fixture reviews passed. Policy defaults, scopes, thresholds, schema, package/lock dependencies and exception semantics are unchanged. [Local regression proof](acceptance.md#patch-101-local-evidence) retains the same-runtime Q2 Windows 255-test result and seven real CLI cases. Q3 adds an explicit fixture conversion policy and a neutral 31-test result. The separate [final hosted qualification](acceptance.md#patch-101-publication-and-hosted-qualification) ran 255 tests with zero failures or skips in each Ubuntu/Windows and Node 24.15.0/24.21.0 combination. Historical v1.0.0 runs remain attributed to that release.

## Patch source and publication selection

The immutable v1.0.1 tag points to release commit R3. Its archive safely pins qualified source and fixture Q3 as 1.0.1. The later documentation head E3 pinned R3 in the adoption examples and local setup at the October 19, 2026 UTC snapshot. Normal integration preserved R3 and the E3 tree; neither the tag nor its archive was rewritten. Exact identities are recorded below.

The 48 manifest assets, action.yml and CI workflow are byte-for-byte and Git-blob identical across Q3/R3/E3. The integrated release validator, source manifest and clean-status checks passed. [Release check 39176654614](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39176654614) used the E3 workflow and checked out R3 in every candidate job. All four `node scripts/validate-examples.mjs --release` steps executed and passed after the locked install. [Final PR CI 39176656062](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39176656062) passed all six jobs at E3. [Post-merge source CI 39178578401](https://github.com/BASIC-BIT/quality-ratchet/actions/runs/39178578401) also passed at the integrated main commit. Earlier Ubuntu fixture setup failures remain historical and are superseded by this final qualification. See the [acceptance record](acceptance.md) for exact results and review limits.

## Behavior and limits

Context-free normalization retains string, template, raw and quoted-attribute distinctions when the tokenizer retains their context. A pre-existing arbitrary-slice limitation remains: a scanner slice that starts and ends inside a quoted attribute can lose the surrounding quote context and treat literal EOL differences as insignificant. That 1.0.1 correction did not claim literal preservation for every arbitrary slice, and 1.1.0 does not change it.

The shared tool retains Git-relative growth rules, tests in enforced scope, lexical complexity identities and 132 routeable duplication formats. It preserves embedded-language detections and reports prose-only Markdown omissions. Source suppression markers fail operationally. Unsupported normalization grammars use conservative raw identities, which can produce additional findings after whitespace or comment changes.

Policy lives in one validated JSON file. Strict exits are 0, 1 and 2. Advisory findings remain visible; operational errors still block. Proposed policy cannot relax its own PR. There is no source allowance registry or warning-only strict flag. Consumer-specific scopes, hook wiring and already-reviewed boundaries need separate migration evidence.

## Qualification and publication

The manual `Release check` workflow accepts a candidate ref and prints its resolved commit and tool manifest. Its only trigger is `workflow_dispatch` with a required `candidate` input, which it passes to the `CI` workflow through `workflow_call`; no push or pull-request event runs it, and no pull request can carry its result. Use a full SHA for reproducible qualification; a tag is resolved independently by each job and their recorded SHAs must agree. A non-empty candidate is also the only condition under which `scripts/validate-examples.mjs --release` runs, which is the check that requires the adoption template's version comment to equal the package version. It runs checks and the package smoke with read-only permissions. It neither publishes nor substitutes for PR, exception or source review evidence.

## Pins and maintenance

The manifest hashes raw runtime asset bytes and verifies the isolated copy against its source on the same machine. Checkout line-ending conversion can change that hash for one Git commit. This repository declares LF text checkout to keep its assets consistent; retain the observed platform manifest with each qualification record. Use the full Git SHA as the portable release identity.

The 1.0.1 adoption template at E3 used a full immutable SHA and a `# v1.0.1` comment. The 1.1.0 template uses the same form against published release commit `a0dfcca184fd83f0a23762f29353c7772c17906f`. No mutable major-version tag is planned. Rollback requires a compatible reviewed pin or a reviewed cutover revert. See [adoption](adoption.md) for the v1.0.0 CRLF caveat.

Version 1.1.0 is cut as a minor release. It rests on the reading that the major-version triggers below cover shared default thresholds and exclusions, configuration semantics as expressed by the policy file, the `QualityReport`, and accepted action inputs, none of which changed. What did change is the commit whose policy is enforced, from the target tip to the merge base, and the hosted evidence envelope's own `schemaVersion`, from 1 to 2. The rule below states that reading for the envelope: its version is independent of the package version and moves on a minor release. Consumers adopting from 1.0.2 must still read the schema 2 changes recorded above.

Current reviewed nested pins:

| Action                  | Version | Full SHA                                   |
| ----------------------- | ------- | ------------------------------------------ |
| actions/checkout        | v7.0.1  | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node      | v7.1.0  | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/upload-artifact | v7.0.2  | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Dependabot checks this repository's GitHub Actions weekly. Consumers must configure their own update PRs where permitted; this repository does not schedule their upgrades.

Changes to shared default thresholds/exclusions, existing configuration semantics, report schema or accepted inputs require a major version. For that rule, the report schema is the `QualityReport` contract wrapped as `quality`, with its own `schemaVersion`, together with the policy JSON schema in `schema/quality-ratchet.schema.json`; the hosted evidence envelope is not part of it. The envelope's `schemaVersion` is versioned independently of the package and moves on a minor release, and the release record for that version states what moved and what a consumer must change. Scanner updates and correctness fixes can change findings even in patch releases, so release notes must explain them. Repository-local policy edits do not require a shared release. Preserve provenance and notices on every release.

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
