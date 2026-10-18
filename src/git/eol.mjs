import { readEolConfig, readEolFiles, sourcePath } from "./commands.mjs";

/** Git computes effective text/eol attributes and its binary heuristic without
 * running clean/smudge filters. Read only already-selected source paths. */
export function workingEolProvenance(repo, paths) {
  const autocrlf = readEolConfig(repo);
  const records = [];
  let batch = [],
    length = 0;
  const read = () => {
    if (!batch.length) return;
    records.push(...readEolFiles(repo, batch).split("\0").filter(Boolean));
    batch = [];
    length = 0;
  };
  for (const path of [...paths].sort()) {
    const literal = sourcePath(path);
    if (length + literal.length + 10 > 8192) read();
    batch.push(literal);
    length += literal.length + 13;
  }
  read();
  const normalizePaths = new Set();
  for (const record of records) {
    const tab = record.indexOf("\t");
    const path = sourcePath(record.slice(tab + 1));
    const [, index, worktree, attr] =
      /^i\/(\S*)\s+w\/(\S*)\s+attr\/(.*?)\s*$/.exec(record.slice(0, tab));
    if (attr === "-text") continue;
    const forced = /^text(?: |$)/.test(attr);
    const automatic =
      attr.startsWith("text=auto") ||
      (!attr && ["true", "input"].includes(autocrlf));
    if (
      forced ||
      (automatic && worktree !== "-text" && !["crlf", "mixed"].includes(index))
    )
      normalizePaths.add(path);
  }
  return { normalizePaths, identity: JSON.stringify([autocrlf, records]) };
}

/** Git CRLF-to-LF conversion preserves every other byte, including lone CR. */
export function canonicalGitEol(bytes) {
  return bytes.includes(13)
    ? bytes.filter((byte, index) => byte !== 13 || bytes[index + 1] !== 10)
    : bytes;
}
