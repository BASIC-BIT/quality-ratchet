import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { formatForPath } from "./formats.mjs";
import { findBashCommentRanges } from "./shell.mjs";
import {
  JS_LIKE_FORMATS,
  parseJsSource,
  scannerSourceRange,
  normalizeCloneSource,
  normalizeCloneSourceRange,
  fingerprintNormalizedClone,
} from "./normalize.mjs";
import {
  isMarkdownTableLayout,
  normalizeMarkdownScannerRange,
} from "./markdown.mjs";
export { sliceScannerSource } from "./normalize.mjs";
export const NORMALIZED_ENDPOINTS = Symbol("normalizedCloneEndpoints");
const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "");
function relTo(repo, p) {
  const n = norm(p);
  const r = norm(repo).replace(/\/$/, "");
  return n.startsWith(r + "/") ? n.slice(r.length + 1) : n;
}

export function scannerRepoPath(repo, scannerName, format) {
  const relative = relTo(repo, scannerName);
  const embeddedSuffix = `:${format}`;
  if (relative.endsWith(embeddedSuffix)) {
    const container = relative.slice(0, -embeddedSuffix.length);
    if (existsSync(resolve(repo, container))) return container;
  }
  return relative;
}

function scannerFilePath(repo, scannerName, format) {
  const candidate = resolve(repo, scannerRepoPath(repo, scannerName, format));
  return existsSync(candidate) ? candidate : null;
}

function sourceIdentityContext(path, format, cache) {
  const key = `${path}\0${format}`;
  if (!cache.has(key)) {
    const source = readFileSync(path, "utf8");
    const containerFormat = formatForPath(path) ?? "text";
    const nativeJsContext =
      JS_LIKE_FORMATS.has(format) && containerFormat === format
        ? parseJsSource(source, format)
        : null;
    const markdownCodeNodes = [];
    if (
      (JS_LIKE_FORMATS.has(format) || format === "bash") &&
      containerFormat === "markdown"
    ) {
      const visit = (node) => {
        if (node.type === "code" && node.position) markdownCodeNodes.push(node);
        for (const child of node.children ?? []) visit(child);
      };
      visit(fromMarkdown(source));
    }
    cache.set(key, {
      source,
      containerFormat,
      // Embedded-language positions refer to their container, which is not a
      // valid JS/TS program. Those spans keep language-local parsing below.
      fullFileRegexRanges: nativeJsContext?.regexRanges ?? null,
      bashCommentRangesPromise: null,
      markdownCodeNodes,
      embeddedContexts: new Map(),
    });
  }
  return cache.get(key);
}

function bashCommentRangesForContext(context, format) {
  if (format !== "bash" || context.containerFormat !== "bash")
    return Promise.resolve([]);
  context.bashCommentRangesPromise ??= findBashCommentRanges(context.source);
  return context.bashCommentRangesPromise;
}

export async function fingerprintScannerEndpoint(
  repo,
  file,
  format,
  sourceCache,
  fallback = null,
) {
  let fragment = fallback;
  let normalized = null;
  let layoutOnly = false;
  try {
    const path = scannerFilePath(repo, file.name, format);
    if (path && Number.isInteger(file.start) && Number.isInteger(file.end)) {
      const context = sourceIdentityContext(path, format, sourceCache);
      const { source, fullFileRegexRanges } = context;
      const bashCommentRanges = await bashCommentRangesForContext(
        context,
        format,
      );
      const range = scannerSourceRange(source, file);
      if (range !== null) {
        fragment = source.slice(...range);
        layoutOnly =
          format === "markdown" &&
          context.containerFormat === "markdown" &&
          isMarkdownTableLayout(source, file);
        normalized =
          context.containerFormat === "markdown" &&
          (JS_LIKE_FORMATS.has(format) || format === "bash")
            ? ((await normalizeMarkdownScannerRange(context, file, format)) ??
              normalizeCloneSource(fragment, format))
            : format === "bash"
              ? normalizeCloneSourceRange(
                  source,
                  format,
                  ...range,
                  [],
                  bashCommentRanges,
                )
              : fullFileRegexRanges === null
                ? normalizeCloneSource(fragment, format)
                : normalizeCloneSourceRange(
                    source,
                    format,
                    ...range,
                    fullFileRegexRanges,
                    bashCommentRanges,
                  );
      }
    }
  } catch {
    // Fall through to the report fragment. Missing fingerprints fail closed in
    // baseline matching instead of suppressing a finding on location alone.
  }
  if (fragment === null) return { fingerprint: null, normalized: null };
  normalized ??=
    format === "bash"
      ? normalizeCloneSource(
          fragment,
          format,
          [],
          await findBashCommentRanges(fragment),
        )
      : normalizeCloneSource(fragment, format);
  return {
    fingerprint: fingerprintNormalizedClone(normalized, format),
    normalized,
    layoutOnly,
  };
}
