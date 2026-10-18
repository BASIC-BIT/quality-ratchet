import { SetupError } from "../git/commands.mjs";
import { JS_LIKE_FORMATS } from "./normalize.mjs";
import { fromMarkdown } from "mdast-util-from-markdown";
import { formatForPath, nativeFormats } from "./formats.mjs";
const startMarker = "jscpd:" + "ignore-start";
const endMarker = "jscpd:" + "ignore-end";
function hasJavascriptSuppression(source) {
  let start = null;
  for (const match of source.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/gu)) {
    if (match[0].includes(startMarker)) start = match.index + match[0].length;
    else if (
      match[0].includes(endMarker) &&
      start !== null &&
      start < match.index
    )
      return true;
  }
  return false;
}
function hasMarkdownSuppression(source) {
  let open = false;
  for (const line of source.split(/\r?\n/u)) {
    if (line.includes(startMarker)) open = true;
    else if (line.includes(endMarker) && open) return true;
  }
  const visit = (node) => {
    if (node.type === "code") {
      const hint = node.lang?.split(/\s/u)[0]?.toLowerCase();
      const language =
        formatForPath("source." + hint) ??
        { shell: "bash", node: "javascript", zsh: "bash", golang: "go" }[
          hint
        ] ??
        (nativeFormats.includes(hint) ? hint : null);
      if (language && hasNativeSuppression(node.value, language)) return true;
    }
    return (node.children ?? []).some(visit);
  };
  return visit(fromMarkdown(source));
}
/** Native matching is textual, including comment-shaped text inside strings. */
export function hasNativeSuppression(source, format) {
  if (!source.includes(startMarker) && !source.includes(endMarker))
    return false;
  if (JS_LIKE_FORMATS.has(format)) return hasJavascriptSuppression(source);
  if (format === "markdown") return hasMarkdownSuppression(source);
  // Generic native tokenizers drop unpaired starts and even orphan-end lines.
  // Container grammars may delegate to them, so reject markers conservatively.
  return true;
}
export function assertNoNativeSuppression(source, format, path) {
  if (hasNativeSuppression(source, format))
    throw new SetupError(
      `Unsupported native suppression in ${JSON.stringify(path)}`,
    );
}
