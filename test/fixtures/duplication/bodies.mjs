export const body = (tag) => `
export function ${tag}(input) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty", value: null };
  }
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, reason: "no-parts", value: null };
  }
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  return { ok: true, reason: null, value: total, parts, count: parts.length };
}
`;

export const replacementBody = (tag) => `
export function ${tag}(input) {
  const values = Array.isArray(input) ? input : [input];
  const cleaned = values.map((value) => String(value ?? "").trim());
  const present = cleaned.filter((value) => value.length > 0);
  const lengths = present.map((value) => value.length);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const longest = lengths.reduce((max, length) => Math.max(max, length), 0);
  const average = present.length === 0 ? 0 : total / present.length;
  const summary = { total, longest, average, count: present.length };
  return { ok: present.length > 0, values: present, summary };
}
`;

export const inlineBoundaryBody = (tag, note) => `
export function ${tag}(input) { const ${tag}Only = "${note}"; const trimmed = String(input ?? "").trim();
  if (!trimmed) {
    return { ok: false, reason: "empty", value: null };
  }
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, reason: "no-parts", value: null };
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const count = parts.length;
  return { ok: true, reason: null, value: total, parts, count };
}
`;

export const divisionArrayBody = (tag, note) => `
export function ${tag}(input) {
  const ${tag}Operand = String(input ?? "").length;
  const ratio = ${tag}Operand
    / [1, // ${note}
      2,
      3,
      4,
      5,
      6,
      7,
      8,
    ].reduce((sum, value) => sum + value, 0);
  const rounded = Math.round(ratio * 100) / 100;
  const status = Number.isFinite(rounded) ? "finite" : "invalid";
  const summary = { ratio, rounded, status };
  return { ok: status === "finite", summary };
}
`;

export const pythonBody = (tag) => `
def ${tag}(value):
    trimmed = str(value or "").strip()
    if not trimmed:
        return {"ok": False, "reason": "empty", "value": None}
    parts = [part.strip() for part in trimmed.split(",") if part.strip()]
    if not parts:
        return {"ok": False, "reason": "no-parts", "value": None}
    total = sum(len(part) for part in parts)
    count = len(parts)
    result = {"ok": True, "reason": None, "value": total}
    result["parts"] = parts
    result["count"] = count
    return result
`;
