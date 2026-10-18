// Adapted from Chronote quality-git.mjs, immutable source and terms in docs/provenance.md.
function decodeGitEscapes(s) {
  let decoded = "";
  for (let index = 0; index < s.length; index += 1) {
    if (s[index] !== "\\" || index + 1 >= s.length) {
      decoded += s[index];
      continue;
    }
    const octalBytes = [];
    while (s[index] === "\\" && /[0-7]/.test(s[index + 1] ?? "")) {
      const match = /^[0-7]{1,3}/.exec(s.slice(index + 1));
      octalBytes.push(Number.parseInt(match[0], 8));
      index += match[0].length + 1;
    }
    if (octalBytes.length) {
      decoded += Buffer.from(octalBytes).toString("utf8");
      index -= 1;
      continue;
    }
    const escaped = s[++index];
    const escapes = {
      a: "\x07",
      b: "\b",
      t: "\t",
      n: "\n",
      v: "\v",
      f: "\f",
      r: "\r",
      '"': '"',
      "\\": "\\",
    };
    decoded += Object.hasOwn(escapes, escaped)
      ? escapes[escaped]
      : `\\${escaped}`;
  }
  return decoded;
}
export function parseDiffPath(rest) {
  let s = rest;
  if (s.startsWith('"')) {
    const end = s.lastIndexOf('"');
    if (end > 0) s = s.slice(1, end);
    s = decodeGitEscapes(s);
  } else {
    const tab = s.indexOf("\t");
    if (tab !== -1) s = s.slice(0, tab);
  }
  if (s === "/dev/null") return null;
  return s.startsWith("b/") ? s.slice(2) : s;
}

/**
 * Parse `git diff --unified=0` into { file -> [[start,end], ...] }.
 *
 * The tricky part is telling a real `+++ b/x` header from diff *content*. An
 * added line whose text begins with "++ " renders as "+++ " once the diff
 * prepends its own "+", and any doc discussing diff syntax contains such lines.
 * Two earlier versions of this parser got fooled, retargeting `file` to a
 * garbage path and silently dropping every later hunk in that section.
 *
 * Content only ever appears *inside* a hunk, and headers only ever appear
 * between `diff --git` and the first `@@`. Tracking that position kills the
 * whole bug class rather than another instance of it: no matter what a line
 * looks like, it cannot be read as a header while we are inside a hunk.
 */
function isFileHeader(line, prev, inHunk) {
  return (
    !inHunk &&
    line.startsWith("+++ ") &&
    prev.startsWith("--- ") &&
    (/^\+\+\+ "?b\//.test(line) || line.slice(4).trim() === "/dev/null")
  );
}
function addDiffHunk(map, file, h) {
  const oldStart = Number(h[1]),
    oldCount = h[2] === undefined ? 1 : Number(h[2]);
  const start = Number(h[3]),
    count = h[4] === undefined ? 1 : Number(h[4]);
  if (!map.has(file)) map.set(file, []);
  if (!map.hunks.has(file)) map.hunks.set(file, []);
  map.hunks
    .get(file)
    .push({ oldStart, oldCount, newStart: start, newCount: count });
  if (count === 0) {
    const boundary = Math.max(1, start);
    map.get(file).push([Math.max(1, boundary - 1), boundary]);
  } else map.get(file).push([start, start + count - 1]);
}
export function parseUnifiedDiff(out) {
  const map = new Map();
  Object.defineProperty(map, "hunks", { value: new Map() });
  let file = null,
    inHunk = false,
    prev = "";
  for (const line of out.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      file = null;
      prev = line;
      continue;
    }
    const header = isFileHeader(line, prev, inHunk);
    prev = line;
    if (header) {
      const p = parseDiffPath(line.slice(4).replace(/\r$/, ""));
      file = p ? p : null;
      continue;
    }
    const h = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!h) continue;
    inHunk = true;
    if (file) addDiffHunk(map, file, h);
  }
  return map;
}

export function parseRenameStatus(out) {
  const renames = [];
  const parts = out.split("\0");
  for (let i = 0; i < parts.length;) {
    const status = parts[i++];
    if (!status) continue;
    const oldPath = parts[i++];
    const newPath =
      status.startsWith("R") || status.startsWith("C") ? parts[i++] : null;
    if (status.startsWith("R") && oldPath && newPath) {
      renames.push({ oldPath: oldPath, newPath: newPath });
    }
  }
  return renames;
}

export const overlaps = (s1, e1, s2, e2) =>
  Math.max(s1, s2) <= Math.min(e1, e2);

export function touchesDiff(ranges, file, start, end) {
  const rs = ranges.get(file);
  if (!rs) return false;
  return rs.some(([a, b]) => overlaps(start, end, a, b));
}
