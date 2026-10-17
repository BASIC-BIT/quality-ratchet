import { createHash } from "node:crypto";
import { tokenize } from "@jscpd/tokenizer";
import ts from "typescript";
import { findBashCommentRanges } from "./shell.mjs";
export const JS_LIKE_FORMATS = new Set([
  "javascript",
  "typescript",
  "tsx",
  "jsx",
]);
export function normalizedCloneContains(base, current) {
  return Boolean(base && current && base.includes(current));
}

function isInsideYamlBlockScalar(source, offset) {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const currentIndent =
    source.slice(lineStart, offset).match(/^ */)?.[0].length ?? 0;
  if (currentIndent === 0) return false;
  const priorLines = source.slice(0, Math.max(0, lineStart - 1)).split(/\r?\n/);
  for (let index = priorLines.length - 1; index >= 0; index -= 1) {
    const line = priorLines[index];
    if (!line.trim()) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent >= currentIndent) continue;
    return /(?:^\s*-\s*|:\s*)[>|](?:[+-]\d?|\d[+-]?)?\s*(?:#.*)?$/.test(line);
  }
  return false;
}

function isYamlScalarHash(source, offset) {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return offset > lineStart && !/\s/.test(source[offset - 1]);
}

export function parseJsSource(source, format) {
  const scriptKind =
    format === "tsx" || format === "jsx"
      ? ts.ScriptKind.TSX
      : format === "javascript"
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    `clone.${format}`,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const ranges = [];
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      ranges.push([node.getStart(sourceFile), node.getEnd()]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { regexRanges: ranges };
}

export function findJsRegexRanges(source, format) {
  return parseJsSource(source, format).regexRanges;
}

function isMisclassifiedComment(
  source,
  format,
  tokens,
  tokenIndex,
  jsRegexRanges = [],
  bashCommentRanges = null,
) {
  const token = tokens[tokenIndex];
  return (
    (format === "yaml" &&
      (isInsideYamlBlockScalar(source, token.range[0]) ||
        isYamlScalarHash(source, token.range[0]))) ||
    (format === "bash" &&
      Array.isArray(bashCommentRanges) &&
      !bashCommentRanges.some(
        ([start, end]) => start <= token.range[0] && token.range[0] < end,
      )) ||
    (JS_LIKE_FORMATS.has(format) &&
      jsRegexRanges.some(
        ([start, end]) => start < token.range[0] && token.range[0] < end,
      ))
  );
}

/** Fingerprint scanner spans while preserving literals. jscpd skips comments
 * and whitespace, so those must not make the same clone look different across
 * snapshots; string contents remain significant. */
export function normalizeCloneSource(
  source,
  format = "text",
  jsRegexRanges,
  bashCommentRanges,
) {
  let tokens;
  try {
    // These native grammars have no matching tokenizer grammar; keep literals conservatively.
    tokens = ["razor", "excel-formula", "text"].includes(format)
      ? [{ type: "raw", value: source, range: [0, source.length] }]
      : tokenize(source, format);
  } catch {
    tokens = [{ type: "raw", value: source, range: [0, source.length] }];
  }
  jsRegexRanges ??= JS_LIKE_FORMATS.has(format)
    ? findJsRegexRanges(source, format)
    : [];
  return (
    "\0" +
    tokens
      .filter((token, tokenIndex) => {
        if (token.type === "empty" || token.type === "new_line") return false;
        if (token.type !== "comment") return true;
        return isMisclassifiedComment(
          source,
          format,
          tokens,
          tokenIndex,
          jsRegexRanges,
          bashCommentRanges,
        );
      })
      .map((token) => JSON.stringify([token.type, token.value]))
      .join("\0") +
    "\0"
  );
}

export function fingerprintNormalizedClone(normalized, format) {
  return createHash("sha256")
    .update(format)
    .update("\0")
    .update(normalized)
    .digest("hex");
}

export function fingerprintCloneSource(source, format = "text") {
  return fingerprintNormalizedClone(
    normalizeCloneSource(source, format),
    format,
  );
}

export async function fingerprintBashCloneSource(source) {
  return fingerprintNormalizedClone(
    normalizeCloneSource(
      source,
      "bash",
      [],
      await findBashCommentRanges(source),
    ),
    "bash",
  );
}

export function normalizeCloneSourceRange(
  source,
  format,
  startOffset,
  endOffset,
  fullFileRegexRanges,
  fullFileBashCommentRanges = [],
) {
  const fragment = source.slice(startOffset, endOffset);
  const jsRegexRanges = JS_LIKE_FORMATS.has(format)
    ? (fullFileRegexRanges ?? findJsRegexRanges(source, format))
        .filter(([start, end]) => start < endOffset && end > startOffset)
        .map(([start, end]) => [start - startOffset, end - startOffset])
    : [];
  const bashCommentRanges =
    format === "bash"
      ? fullFileBashCommentRanges
          .filter(([start, end]) => start < endOffset && end > startOffset)
          .map(([start, end]) => [start - startOffset, end - startOffset])
      : [];
  return normalizeCloneSource(
    fragment,
    format,
    jsRegexRanges,
    bashCommentRanges,
  );
}

export function scannerSourceRange(source, file) {
  const startLine = file.startLoc?.line ?? file.start;
  const endLine = file.endLoc?.line ?? file.end;
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return null;
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") lineStarts.push(index + 1);
  }
  const startLineOffset = lineStarts[startLine - 1];
  const endLineOffset = lineStarts[endLine - 1];
  if (startLineOffset === undefined || endLineOffset === undefined)
    return [0, 0];

  const contentEnd = (line) => {
    let offset = lineStarts[line] ?? source.length;
    if (source[offset - 1] === "\n") offset -= 1;
    if (source[offset - 1] === "\r") offset -= 1;
    return offset;
  };
  const startColumn = file.startLoc?.column;
  const endColumn = file.endLoc?.column;
  // Native columns count UTF-8 bytes, while JavaScript slices count UTF-16 units.
  const columnOffset = (line, column) =>
    lineStarts[line - 1] +
    Buffer.from(source.slice(lineStarts[line - 1], contentEnd(line)))
      .subarray(0, column)
      .toString("utf8").length;
  const startOffset = Number.isInteger(startColumn)
    ? columnOffset(startLine, startColumn)
    : startLineOffset;
  const endOffset = Number.isInteger(endColumn)
    ? columnOffset(endLine, endColumn)
    : contentEnd(endLine);
  return [startOffset, Math.max(startOffset, endOffset)];
}

export function sliceScannerSource(source, file) {
  const range = scannerSourceRange(source, file);
  return range === null ? null : source.slice(...range);
}
