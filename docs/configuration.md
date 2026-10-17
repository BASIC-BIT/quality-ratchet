# Repository policy

Place `quality-ratchet.json` at the repository root. The [schema](../schema/quality-ratchet.schema.json) is version 1. The [validated example](../examples/quality-ratchet.json) illustrates defaults and a package complexity advisory.

A missing configuration resolves to shared defaults. Deletion is a proposed policy change, so a PR deleting its configuration still runs under the target's policy. Local comparisons use the baseline commit's policy. Both trees use the same resolved policy, identified by a SHA-256 hash.

## Checks and modes

| Setting                        | Default               | Meaning                                                         |
| ------------------------------ | --------------------- | --------------------------------------------------------------- |
| `checks.complexity.cyclomatic` | 15                    | New or worsening touched functions above this value fail        |
| `checks.complexity.cognitive`  | 15                    | Independent cognitive limit                                     |
| `checks.fileSize.maxLines`     | 1000                  | New files must be smaller; existing oversized files cannot grow |
| `checks.duplication.minLines`  | 8                     | Minimum duplicate span lines                                    |
| `checks.duplication.minTokens` | 50                    | Minimum duplicate tokens                                        |
| `checks.duplication.formats`   | All routeable formats | Explicit supported format names                                 |

Each check has `mode`, `include` and `exclude`. Modes are `ratchet`, `advisory` and `off`. Advisory and off modes require a nonempty reason. Advisory findings do not block; enabled scanner failures always block. Disabled checks report disabled coverage. All-advisory rollout is allowed. All-off or wholly empty enabled source coverage is invalid.

Complexity and file size support .js, .jsx, .mjs, .cjs, .ts, .tsx, .mts and .cts. Duplication retains native container behavior and broader routes. Its prose-only Markdown omission and conservative normalization are explicit [limits](supported-formats.md).

## Paths and overrides

`scope.include` and `scope.exclude` select authored source globally. Check-level paths narrow that scope. Dependency directories and Git/tool storage are always excluded. Generated build output and declaration files are excluded by default; configured global exclusions extend those generated defaults. Tests, fixtures, stories, scripts and configuration are otherwise in scope.

Use case-sensitive repository-relative forward-slash globs. Supported patterns include `*`, `**`, `?`, character classes and brace alternatives. Absolute paths, parent traversal, backslashes, extglobs and leading negation are rejected.

Each `overrides` entry requires `files`, a reason and a `checks` object. Matching entries apply in array order; later explicitly supplied properties win. Complexity and file-size overrides may adjust mode or thresholds and re-enable a globally disabled check. Duplication remains repository-wide and has no per-path override. Recognized renames use destination policy for both measurements. Invalid or overlapping entries are not an escape from validation.

## Reports and errors

`reports.testDebt` enables the informational test-involved duplication inventory. It defaults on with duplication and cannot explicitly be true when duplication is off. `reports.testSize` has `enabled` and `oversizedLines`, defaulting to true and 1000. Absolute reports do not decide merge eligibility.

Unknown keys, invalid thresholds/formats, missing reasons and malformed globs fail with exit 2. There are no workflow inputs, environment settings, strict-check CLI threshold flags, executable plugins, source-comment suppressions or fingerprint allowances that override policy.

`explain-config` shows active/proposed policy and the config commit. A configuration edit must be separately reviewed and integrated before later PRs use it.
