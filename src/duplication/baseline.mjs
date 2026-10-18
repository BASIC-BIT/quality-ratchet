import { overlaps, touchesDiff } from "../git/diff.mjs";
import { NORMALIZED_ENDPOINTS } from "./identity.mjs";
import { normalizedCloneContains } from "./normalize.mjs";
export function dedupe(findings) {
  const kept = [];
  for (const f of findings) {
    const seen = kept.some((k) => findingsOverlap(k, f));
    if (!seen) kept.push(f);
  }
  return kept;
}

function findingsOverlap(a, b) {
  return (
    (a.a === b.a &&
      a.b === b.b &&
      overlaps(a.as, a.ae, b.as, b.ae) &&
      overlaps(a.bs, a.be, b.bs, b.be)) ||
    (a.a === b.b &&
      a.b === b.a &&
      overlaps(a.as, a.ae, b.bs, b.be) &&
      overlaps(a.bs, a.be, b.as, b.ae))
  );
}

function eligibleRow(r, opts) {
  if (r.a === r.b && overlaps(r.as, r.ae, r.bs, r.be)) return null;
  if (
    r.lines < opts.minLines ||
    (r.tokens !== undefined && r.tokens < (opts.minTokens ?? 0))
  )
    return null;
  return r;
}

export function classify(rows, ranges, opts) {
  const findings = [];
  for (const r of rows) {
    const eligible = eligibleRow(r, opts);
    if (!eligible) continue;

    const aNew = touchesDiff(ranges, eligible.a, eligible.as, eligible.ae);
    const bNew = touchesDiff(ranges, eligible.b, eligible.bs, eligible.be);
    if (!aNew && !bNew) continue; // pre-existing: not this diff's problem

    const endpointExisted = (side) => {
      const path = eligible[side];
      const changes = ranges.renames;
      if (changes?.newPaths?.has(path)) return false;
      const start = eligible[`${side}s`];
      const end = eligible[`${side}e`];
      return !(changes?.hunks?.get(path) ?? ranges.hunks?.get(path) ?? []).some(
        (hunk) =>
          hunk.newCount > 0 &&
          start >= hunk.newStart &&
          end <= hunk.newStart + hunk.newCount - 1,
      );
    };
    const exactlyOneExisted =
      aNew && bNew && endpointExisted("a") !== endpointExisted("b");
    findings.push({
      ...eligible,
      aTouched: aNew,
      bTouched: bNew,
      verdict:
        aNew && bNew && !exactlyOneExisted
          ? "added-twice"
          : "duplicates-existing",
    });
  }
  return findings.sort(
    (x, y) => Number(y.sameName) - Number(x.sameName) || y.lines - x.lines,
  );
}

function translateCurrentRangeToBase(start, end, hunks) {
  const translateLine = (line) => {
    let offset = 0;
    for (const hunk of hunks) {
      if (hunk.newCount === 0) {
        // Git uses the line before the insertion point for +N,0 hunks. A
        // surviving line at that boundary therefore follows the deletion.
        if (hunk.newStart === 0 || line > hunk.newStart)
          offset += hunk.oldCount;
        continue;
      }
      const newEnd = hunk.newStart + hunk.newCount - 1;
      if (line > newEnd) {
        offset += hunk.oldCount - hunk.newCount;
      } else if (line >= hunk.newStart) {
        // A coordinate inside a replacement is unambiguous only when old and
        // new subranges have the same size. This relative mapping keeps
        // repeated occurrences inside broad rename hunks distinct.
        if (hunk.oldCount !== hunk.newCount) return null;
        return hunk.oldStart + (line - hunk.newStart);
      }
    }
    return line + offset;
  };
  const translatedStart = translateLine(start);
  const translatedEnd = translateLine(end);
  if (translatedStart === null || translatedEnd === null) return null;
  return [translatedStart, translatedEnd];
}

function endpointMatches(current, base, side, baseSide, renames) {
  const currentPath = current[side];
  const basePath = base[baseSide];
  const renamedFrom = renames.get(currentPath);
  const pathAtBase = renamedFrom ?? currentPath;
  if (pathAtBase !== basePath) return false;
  const translated = translateCurrentRangeToBase(
    current[`${side}s`],
    current[`${side}e`],
    renames.hunks?.get(currentPath) ?? [],
  );
  // On a stable path, raw overlap remains a precise occurrence identity when
  // a replacement changes line counts and cannot be translated. Renames do
  // not have that guarantee: a broad hunk can move identical occurrences.
  if (!translated) {
    const insidePureAddition = (renames.hunks?.get(currentPath) ?? []).some(
      (hunk) =>
        hunk.oldCount === 0 &&
        hunk.newCount > 0 &&
        current[`${side}s`] >= hunk.newStart &&
        current[`${side}e`] <= hunk.newStart + hunk.newCount - 1,
    );
    return (
      !renamedFrom &&
      !insidePureAddition &&
      overlaps(
        current[`${side}s`],
        current[`${side}e`],
        base[`${baseSide}s`],
        base[`${baseSide}e`],
      )
    );
  }
  return overlaps(
    translated[0],
    translated[1],
    base[`${baseSide}s`],
    base[`${baseSide}e`],
  );
}

function endpointIdentityMatches(current, base, side, baseSide) {
  const currentFingerprint = current[`${side}f`];
  const baseFingerprint = base[`${baseSide}f`];
  if (
    currentFingerprint &&
    baseFingerprint &&
    currentFingerprint === baseFingerprint
  )
    return true;
  const currentNormalized = current[NORMALIZED_ENDPOINTS]?.[side];
  const baseNormalized = base[NORMALIZED_ENDPOINTS]?.[baseSide];
  return normalizedCloneContains(baseNormalized, currentNormalized);
}

/** A candidate is pre-existing only when the same engine found the same file
 * pair in an isolated merge-base snapshot and at least one normalized endpoint
 * is unchanged. This keeps one-sided edits on the existing-clone side of the
 * ratchet while treating two in-place rewrites as a new clone identity. */
export function wasFindingPresentAtBase(
  finding,
  baselineRows,
  renames = new Map(),
) {
  return baselineRows.some((base) => {
    if (base.kind !== finding.kind) return false;
    // Overlapping ranges alone are not enough for token clones. A merge-base
    // clone may cover only the unchanged prefix/suffix around a difference;
    // deleting that difference creates a larger exact clone in the current
    // tree. Treat it as pre-existing only when the old exact clone was at
    // least as large as the current one. `lines` is a defensive fallback for
    // scanner reports that omit token counts.
    if (
      Number(base.tokens ?? base.lines) <
      Number(finding.tokens ?? finding.lines)
    ) {
      return false;
    }

    const direct =
      endpointMatches(finding, base, "a", "a", renames) &&
      endpointMatches(finding, base, "b", "b", renames);
    if (
      direct &&
      (endpointIdentityMatches(finding, base, "a", "a") ||
        endpointIdentityMatches(finding, base, "b", "b"))
    ) {
      return true;
    }

    const reversed =
      endpointMatches(finding, base, "a", "b", renames) &&
      endpointMatches(finding, base, "b", "a", renames);
    return (
      reversed &&
      (endpointIdentityMatches(finding, base, "a", "b") ||
        endpointIdentityMatches(finding, base, "b", "a"))
    );
  });
}

export function filterPreExisting(
  candidates,
  baselineRows,
  renames = new Map(),
) {
  const findings = [];
  let preExisting = 0;
  for (const finding of candidates) {
    if (wasFindingPresentAtBase(finding, baselineRows, renames)) {
      preExisting += 1;
    } else {
      findings.push(finding);
    }
  }
  return { findings: dedupe(findings), preExisting };
}
