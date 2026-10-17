import { parse as parseShell } from "sh-syntax";
function collectBashCommentRanges(value, ranges = [], seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return ranges;
  seen.add(value);
  if (
    Number.isInteger(value.Hash?.Offset) &&
    Number.isInteger(value.End?.Offset)
  ) {
    ranges.push([value.Hash.Offset, value.End.Offset]);
  }
  for (const child of Object.values(value))
    collectBashCommentRanges(child, ranges, seen);
  return ranges;
}

export async function findBashCommentRanges(source) {
  try {
    const tree = await parseShell(source, {
      keepComments: true,
      recoverErrors: 10,
    });
    const bytes = Buffer.from(source, "utf8");
    const stringOffset = (byteOffset) =>
      bytes.subarray(0, byteOffset).toString("utf8").length;
    return collectBashCommentRanges(tree).map(([start, end]) => [
      stringOffset(start),
      stringOffset(end),
    ]);
  } catch {
    // Unsupported or incomplete shell remains fail-safe: retaining every token
    // may create a false positive, but cannot hide newly duplicated source.
    return [];
  }
}
