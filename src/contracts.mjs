/**
 * @typedef {"duplication" | "complexity" | "file-size"} GateName
 * @typedef {"ratchet" | "advisory" | "off"} CheckMode
 * @typedef {{include?: string[], exclude?: string[]}} ScopeInput
 * @typedef {{mode?: CheckMode, reason?: string}} ModeInput
 * @typedef {ModeInput & {cyclomatic?: number, cognitive?: number}} ComplexityOverride
 * @typedef {ModeInput & {maxLines?: number}} FileSizeOverride
 * @typedef {ComplexityOverride & ScopeInput} ComplexityInput
 * @typedef {FileSizeOverride & ScopeInput} FileSizeInput
 * @typedef {ModeInput & ScopeInput & {minLines?: number, minTokens?: number, formats?: string[]}} DuplicationInput
 * @typedef {{files: string[], reason: string, checks: {complexity?: ComplexityOverride, fileSize?: FileSizeOverride}}} PolicyOverride
 * @typedef {{testDebt?: boolean, testSize?: {enabled?: boolean, oversizedLines?: number}}} ReportsInput
 * @typedef {{schemaVersion: 1, scope?: ScopeInput, checks?: {complexity?: ComplexityInput, fileSize?: FileSizeInput, duplication?: DuplicationInput}, overrides?: PolicyOverride[], reports?: ReportsInput}} ConfigInput
 *
 * @typedef {{include: string[], exclude: string[]}} ResolvedScope
 * @typedef {{mode: CheckMode, reason: string | null, include: string[], exclude: string[]}} ResolvedCheck
 * @typedef {ResolvedCheck & {cyclomatic: number, cognitive: number}} ResolvedComplexity
 * @typedef {ResolvedCheck & {maxLines: number}} ResolvedFileSize
 * @typedef {ResolvedCheck & {minLines: number, minTokens: number, formats: string[]}} ResolvedDuplication
 * @typedef {{schemaVersion: 1, scope: ResolvedScope, checks: {complexity: ResolvedComplexity, fileSize: ResolvedFileSize, duplication: ResolvedDuplication}, overrides: PolicyOverride[], reports: {testDebt: boolean, testSize: {enabled: boolean, oversizedLines: number}}, hash: string}} ResolvedPolicy
 * @typedef {{mode: CheckMode, reason: string | null, thresholds: {cyclomatic?: number, cognitive?: number, maxLines?: number, minLines?: number, minTokens?: number}, overrideIndices: number[]}} EffectiveCheck
 * @typedef {{path: string, before: unknown, after: unknown}} PolicyDifference
 * @typedef {{active: ResolvedPolicy, proposed: ResolvedPolicy, configCommit: string, changed: boolean, diff: PolicyDifference[]}} PolicySelection
 *
 * Policy hashes cover recursively key-sorted resolved settings, excluding hash itself.
 * Absence or deletion resolves to defaults. Proposed settings never replace active enforcement.
 * Scope matching is a pure path/language/filter decision, independent of effective mode.
 * Discovery rejects symlinks and enumerates real files; the runner must reject empty enabled coverage.
 * Gate findings retain scanner-specific fields and add mode and overrideIndices.
 */
export {};
