// Adapted from immutable Chronote/Perkcord generic gates; terms in docs/provenance.md.
import { createRequire } from "node:module";
import { join, relative, isAbsolute } from "node:path";
import { overlaps } from "../git/diff.mjs";
import { SetupError } from "../git/commands.mjs";
const keyName = (key) => {
  if (!key) return null;
  if (key.type === "Identifier" || key.type === "PrivateIdentifier")
    return key.name;
  if (key.type === "Literal") return String(key.value);
  return null;
};

const KEYED_PARENTS = new Set([
  "MethodDefinition",
  "PropertyDefinition",
  "Property",
]);

/**
 * Where a rule may start reporting this function. Both rules report a method,
 * a getter or a property function at its key, which sits before the function
 * node itself, so the record has to start at the key to contain the message.
 */
const headStart = (node) => {
  const p = node.parent;
  return p && KEYED_PARENTS.has(p.type) && p.value === node
    ? p.loc.start
    : node.loc.start;
};

const enclosingClassName = (node) => {
  for (let n = node.parent; n; n = n.parent) {
    if (n.type === "ClassDeclaration" || n.type === "ClassExpression")
      return n.id?.name ?? null;
  }
  return null;
};

const ACCESSOR_KINDS = new Set(["get", "set"]);

const OWNER_STOPS = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ClassBody",
]);

/**
 * The variable an object-literal member ultimately belongs to: `createItem`
 * for `export const createItem = mutation({ handler })`. The walk stops at
 * a function or class boundary so the prefix never comes from an outer scope,
 * and an object literal with no declarator above it (a bare call argument, a
 * default export) has no owner.
 */
const objectLiteralOwner = (node) => {
  for (let n = node.parent; n && !OWNER_STOPS.has(n.type); n = n.parent) {
    if (n.type === "VariableDeclarator")
      return n.id.type === "Identifier" ? n.id.name : null;
  }
  return null;
};

/**
 * Name of a method or property function: `Class.m` in a class, `owner.m` for a
 * member of an object literal a variable holds, a bare `m` when there is no
 * such owner. An accessor carries its kind (`Class.get x`) so a getter and its
 * setter are never the same function to the ratchet.
 */
const memberName = (p) => {
  const key = p.computed && p.key.type !== "Literal" ? null : keyName(p.key);
  if (key === null) return null;
  const named = ACCESSOR_KINDS.has(p.kind) ? `${p.kind} ${key}` : key;
  const owner =
    p.type === "Property" ? objectLiteralOwner(p) : enclosingClassName(p);
  return owner ? `${owner}.${named}` : named;
};

/**
 * Identity of a function for base-vs-head matching. Named things get their
 * name; methods get Class.method; anything else is null and is keyed by the
 * caller as <nearest named ancestor>#<ordinal>.
 */
const assignmentName = (node) => {
  if (node.type === "Identifier" || node.type === "ThisExpression")
    return node.name ?? "this";
  if (node.type !== "MemberExpression") return null;
  if (node.computed && node.property.type !== "Literal") return null;
  const owner = assignmentName(node.object),
    key = keyName(node.property);
  return owner !== null && key !== null ? `${owner}.${key}` : null;
};
export function functionName(node) {
  if (node.id) return node.id.name;
  const p = node.parent;
  if (!p) return null;
  if (p.type === "VariableDeclarator" && p.id.type === "Identifier")
    return p.id.name;
  if (KEYED_PARENTS.has(p.type) && p.value === node) return memberName(p);
  if (p.type === "AssignmentExpression" && p.right === node)
    return assignmentName(p.left);
  return null;
}

// Each linter owns its records; files are measured sequentially.

const recordFunctions = (records) => ({
  rules: {
    functions: {
      create() {
        const stack = [{ key: "<module>", named: true, anon: 0 }];
        const enter = (node) => {
          const own = functionName(node);
          let key = own;
          if (key === null) {
            const ancestor = stack.findLast((f) => f.named);
            key = `${ancestor.key}#${++ancestor.anon}`;
          } else if (stack.length > 1) key = `${stack.at(-1).key}/${key}`;
          stack.push({ key, named: own !== null, anon: 0 });
          records.push({ key, start: headStart(node), end: node.loc.end });
        };
        const exit = () => stack.pop();
        return {
          FunctionDeclaration: enter,
          FunctionExpression: enter,
          ArrowFunctionExpression: enter,
          "FunctionDeclaration:exit": exit,
          "FunctionExpression:exit": exit,
          "ArrowFunctionExpression:exit": exit,
        };
      },
    },
  },
});

export function makeLinter(cwd, toolRoot) {
  const require = createRequire(join(toolRoot, "package.json"));
  const load = (name) => {
    const entry = require.resolve(name);
    const inside = relative(join(toolRoot, "node_modules"), entry);
    if (isAbsolute(inside) || inside.startsWith(".."))
      throw new Error("Dependency outside tool root");
    return require(entry);
  };
  let ESLint, sonarjs, tseslint;
  try {
    ({ ESLint } = load("eslint"));
    sonarjs = load("eslint-plugin-sonarjs");
    tseslint = load("typescript-eslint");
  } catch {
    throw new SetupError(
      "Locked ESLint dependencies are missing or cannot load",
    );
  }
  const records = [];
  return {
    records,
    lint: new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.{js,jsx,cjs,mjs,ts,tsx,cts,mts}"],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: { ecmaFeatures: { jsx: true } },
            sourceType: "module",
          },
          linterOptions: { noInlineConfig: true },
          plugins: { sonarjs, ratchet: recordFunctions(records) },
          rules: {
            complexity: ["error", 0],
            "sonarjs/cognitive-complexity": ["error", 0],
            "ratchet/functions": "error",
          },
        },
        {
          files: ["**/*.{cjs,cts}"],
          languageOptions: { sourceType: "commonjs" },
        },
      ],
    }),
  };
}

const before = (a, b) =>
  a.line < b.line || (a.line === b.line && a.column <= b.column);

/**
 * A record contains a message position when the message falls between the
 * record's head and its end. `headStart` already moves a method's record back
 * to its key, so this is a plain containment check. The caller's innermost
 * tie-break compares the raw start.
 */
const contains = (r, at) => before(r.start, at) && before(at, r.end);

const VALUE_RES = new Map([
  [
    "complexity",
    /^(?:.+) has a complexity of (\d+)\. Maximum allowed is 0\.$/u,
  ],
  [
    "sonarjs/cognitive-complexity",
    /^Refactor this function to reduce its Cognitive Complexity from (\d+) to the 0 allowed\.$/u,
  ],
]);

/**
 * Disambiguate keys that repeat inside one file, in source order: the first
 * occurrence keeps its name, later ones get `~2`, `~3`. Base and head are
 * suffixed the same way, so without this a grown function could pass silently
 * against a same-named sibling's value.
 */
const uniqueKeys = (keys) => {
  const seen = new Map();
  return keys.map((k) => {
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k}~${n}`;
  });
};

/**
 * Attach each rule message to the innermost recorded function containing it.
 * `complexity` reports at the function head and SonarJS at the name or the
 * arrow token, so position containment is the join, not equality. A function
 * can draw more than one message from the same rule (a class field arrow is
 * both a method and a field initializer), so the highest value wins.
 *
 * A message whose value cannot be read is a setup error, never a 1/0 default:
 * a reworded upstream message would otherwise make every function look clean.
 * A message that lands in no recorded function is dropped, since a module-level
 * class static block legitimately reports without being a function.
 */
export function joinMessages(recs, messages, filePath = "<input>") {
  const keys = uniqueKeys(recs.map((r) => r.key));
  const families = Map.groupBy(recs, (r) => r.key);
  const fns = recs.map((r, i) => ({
    key: keys[i],
    familySize: families.get(r.key).length,
    start: r.start.line,
    end: r.end.line,
    cyclomatic: 1,
    cognitive: 0,
  }));
  const seen = new Map();
  for (const m of messages) {
    const re = VALUE_RES.get(m.ruleId);
    if (!re) continue;
    const found = re.exec(m.message);
    if (
      !found ||
      !Number.isSafeInteger(Number(found[1])) ||
      Number(found[1]) <= 0
    )
      throw new SetupError(
        `${filePath}: unrecognised ${m.ruleId} metric message`,
      );
    if (
      !Number.isSafeInteger(m.line) ||
      m.line <= 0 ||
      !Number.isSafeInteger(m.column) ||
      m.column <= 0
    )
      throw new SetupError(`${filePath}: invalid metric position`);
    const location = `${m.ruleId}:${m.line}:${m.column}`;
    const value = Number(found[1]);
    if (seen.has(location) && seen.get(location) !== value)
      throw new SetupError(`${filePath}: conflicting metric messages`);
    seen.set(location, value);
    const at = { line: m.line, column: m.column - 1 };
    let idx = -1;
    recs.forEach((r, i) => {
      if (contains(r, at) && (idx < 0 || before(recs[idx].start, r.start)))
        idx = i;
    });
    if (idx < 0) continue;
    const field = m.ruleId === "complexity" ? "cyclomatic" : "cognitive";
    fns[idx][field] = Math.max(fns[idx][field], Number(found[1]));
  }
  return fns;
}

export async function lintSource(linter, text, filePath) {
  linter.records.length = 0;
  const [result] = await linter.lint.lintText(text, { filePath });
  const fatal = result.messages.find((m) => m.fatal);
  if (fatal) throw new SetupError(`${filePath}:${fatal.line}: Parsing error`);
  // A path ESLint declines to lint (its default node_modules ignore, say)
  // returns no records at all, which would otherwise read as a clean file.
  const ignored = result.messages.find(
    (m) => m.ruleId === null && /ignored/i.test(m.message),
  );
  if (ignored) throw new SetupError(`${filePath}: ${ignored.message}`);
  const lines = text.split(/\r\n|\r|\n/u);
  for (const m of result.messages) {
    if (
      VALUE_RES.has(m.ruleId) &&
      (!Number.isSafeInteger(m.line) ||
        !Number.isSafeInteger(m.column) ||
        m.line < 1 ||
        m.line > lines.length ||
        m.column < 1 ||
        m.column > lines[m.line - 1].length + 1)
    )
      throw new SetupError(`${filePath}: invalid metric position`);
    if (m.severity === 2 && !VALUE_RES.has(m.ruleId))
      throw new SetupError(`${filePath}: unexpected lint error`);
  }
  return joinMessages(linter.records, result.messages, filePath);
}

export const candidates = (fns, ranges, thresholds) =>
  fns.filter(
    (f) =>
      (f.cyclomatic > thresholds.cyclomatic ||
        f.cognitive > thresholds.cognitive) &&
      ranges.some(([s, e]) => overlaps(s, e, f.start, f.end)),
  );

/** base === null means the file did not exist at the merge base. */
export function verdicts(cands, base) {
  const byKey = new Map((base ?? []).map((f) => [f.key, f]));
  const out = [];
  for (const f of cands) {
    const b = byKey.get(f.key);
    if (!b || f.familySize !== b.familySize)
      out.push({
        ...f,
        baseCyclomatic: null,
        baseCognitive: null,
        verdict: "NEW",
      });
    else if (f.cyclomatic > b.cyclomatic || f.cognitive > b.cognitive) {
      out.push({
        ...f,
        baseCyclomatic: b.cyclomatic,
        baseCognitive: b.cognitive,
        verdict: "GREW",
      });
    }
  }
  return out;
}
