import { minimatch } from "minimatch";

const options = {
  dot: true,
  nocase: false,
  nonegate: true,
  nocomment: true,
  noext: true,
};

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
  const stack = [];
  for (const character of pattern) {
    if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      if (stack.pop() !== (character === "}" ? "{" : "[")) return false;
    }
  }
  if (stack.length) return false;
  try {
    return minimatch.makeRe(pattern, options) !== false;
  } catch {
    return false;
  }
}

export function repositoryPath(path) {
  const normalized = path.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/u.test(normalized) ||
    /[\x00-\x1f\x7f]/u.test(normalized) ||
    normalized
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(
      `Expected a repository-relative file path: ${JSON.stringify(path)}`,
    );
  }
  return normalized;
}

export function matchesAny(path, patterns) {
  return patterns.some((pattern) => minimatch(path, pattern, options));
}
