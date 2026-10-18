import { minimatch } from "minimatch";

const options = {
  dot: true,
  nocase: false,
  nonegate: true,
  nocomment: true,
  noext: true,
};

function balancedDelimiters(pattern) {
  const stack = [];
  for (const character of pattern) {
    if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      if (stack.pop() !== (character === "}" ? "{" : "[")) return false;
    }
  }
  return stack.length === 0;
}

export function validGlob(pattern) {
  if (
    !pattern ||
    /[\\\x00-\x1f\x7f():|]/u.test(pattern) ||
    pattern.startsWith("!") ||
    pattern.startsWith("/") ||
    /^[A-Za-z]:/u.test(pattern)
  )
    return false;
  if (pattern.split("/").some((segment) => segment === ".." || segment === "."))
    return false;
  if (!balancedDelimiters(pattern)) return false;
  try {
    return minimatch.makeRe(pattern, options) !== false;
  } catch {
    return false;
  }
}

export { sourcePath as repositoryPath } from "../git/commands.mjs";

export function matchesAny(path, patterns) {
  return patterns.some((pattern) => minimatch(path, pattern, options));
}
