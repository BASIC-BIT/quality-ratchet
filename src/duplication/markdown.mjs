import { fromMarkdown } from "mdast-util-from-markdown";
import { findBashCommentRanges } from "./shell.mjs";
import {
  parseJsSource,
  scannerSourceRange,
  normalizeCloneSourceRange,
} from "./normalize.mjs";
export async function normalizeMarkdownScannerRange(context, file, format) {
  const startLine = file.startLoc?.line ?? file.start;
  const endLine = file.endLoc?.line ?? file.end;
  const node = context.markdownCodeNodes.find(
    (candidate) =>
      startLine > candidate.position.start.line &&
      (endLine < candidate.position.end.line ||
        (endLine === candidate.position.end.line &&
          Number.isInteger(file.endLoc?.column) &&
          file.endLoc.column <= candidate.position.end.column)),
  );
  if (!node) return null;
  const key = `${node.position.start.offset}:${format}`;
  if (!context.embeddedContexts.has(key)) {
    context.embeddedContexts.set(
      key,
      format === "bash"
        ? findBashCommentRanges(node.value).then((bashCommentRanges) => ({
            source: node.value,
            regexRanges: [],
            literalRanges: [],
            bashCommentRanges,
          }))
        : Promise.resolve({
            source: node.value,
            ...parseJsSource(node.value, format),
            bashCommentRanges: [],
          }),
    );
  }
  const embedded = await context.embeddedContexts.get(key);
  const lineOffset = node.position.start.line;
  const embeddedFile = {
    ...file,
    start: startLine - lineOffset,
    end: endLine - lineOffset,
    startLoc: file.startLoc && {
      ...file.startLoc,
      line: file.startLoc.line - lineOffset,
    },
    endLoc: file.endLoc && {
      ...file.endLoc,
      line: file.endLoc.line - lineOffset,
    },
  };
  const range = scannerSourceRange(embedded.source, embeddedFile);
  if (range === null) return null;
  return normalizeCloneSourceRange(
    embedded.source,
    format,
    ...range,
    embedded.regexRanges,
    embedded.bashCommentRanges,
    embedded.literalRanges,
  );
}

// jscpd can join separator tokens across unrelated Markdown tables. Only
// discard a pair when an actual source span contains table layout alone.
export function isMarkdownTableLayout(source, file) {
  const range = scannerSourceRange(source, file);
  if (!range) return false;
  const fragment = source.slice(...range);
  if (
    !/^[\s|:-]+$/.test(fragment) ||
    !fragment.includes("|") ||
    !fragment.includes("-")
  ) {
    return false;
  }
  const containsLiteral = (node) =>
    ((node.type === "code" || node.type === "inlineCode") &&
      node.position.start.offset < range[1] &&
      node.position.end.offset > range[0]) ||
    (node.children ?? []).some(containsLiteral);
  return !containsLiteral(fromMarkdown(source));
}
