import { realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
export class SetupError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "SetupError";
    this.exitCode = 2;
  }
}
export function sourcePath(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/u.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..") ||
    path.includes("\\")
  )
    throw new SetupError(`Invalid Git source path: ${JSON.stringify(path)}`);
  return path;
}
const nullFile = process.platform === "win32" ? "NUL" : "/dev/null";
export function git(repo, args, options = {}) {
  return runGit(repo, args, options);
}

// These fixed read operations need the actual EOL configuration, but cannot
// request filters, hooks, textconv, an editor or any modifying Git command.
export function readEolConfig(repo) {
  return runGit(
    repo,
    [
      "config",
      "--get",
      "--type=bool-or-str",
      "--default=false",
      "core.autocrlf",
    ],
    {},
    true,
  ).trim();
}
export function readEolFiles(repo, paths) {
  return runGit(
    repo,
    [
      `--work-tree=${repo}`,
      "ls-files",
      "--eol",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...paths.map((path) => `:(literal)${sourcePath(path)}`),
    ],
    {},
    true,
  );
}
function runGit(repo, args, options, eolData = false) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  Object.assign(
    env,
    {
      GIT_CONFIG_NOSYSTEM: eolData ? undefined : "1",
      GIT_CONFIG_GLOBAL: eolData ? undefined : nullFile,
      GIT_ATTR_NOSYSTEM: eolData ? undefined : "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
    },
    options.env,
  );
  try {
    return execFileSync(
      "git",
      [
        "-c",
        "core.fsmonitor=false",
        "-c",
        `core.hooksPath=${nullFile}`,
        ...(eolData ? [] : ["-c", `core.attributesFile=${nullFile}`]),
        "-c",
        "core.quotePath=true",
        ...args,
      ],
      {
        cwd: repo,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 180_000,
        stdio: ["pipe", "pipe", "pipe"],
        ...options,
        env,
        shell: false,
      },
    );
  } catch (cause) {
    throw new SetupError(`Git ${args[0]} failed`, { cause });
  }
}
export function tryGit(repo, args) {
  try {
    return git(repo, args).trim();
  } catch {
    return null;
  }
}
export function resolveCommit(repo, ref) {
  if (
    typeof ref !== "string" ||
    !ref ||
    ref.startsWith("-") ||
    ref.includes("\0")
  )
    throw new SetupError("Expected a commit reference");
  const sha = git(repo, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]).trim();
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(sha))
    throw new SetupError("Invalid commit identity");
  return sha;
}
export function verifyTree(repo, sha) {
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(sha))
    throw new SetupError("currentTree must be a full Git object SHA");
  return git(repo, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${sha}^{tree}`,
  ]).trim();
}

/** Stop cat-file after bounded stdout; preserve every other Git failure. */
export function gitBlobPrefix(repo, object, limit) {
  try {
    return git(repo, ["cat-file", "blob", object], {
      encoding: null,
      maxBuffer: limit,
    }).subarray(0, limit);
  } catch (error) {
    const cause = error.cause;
    if (
      cause?.code === "ENOBUFS" &&
      Buffer.isBuffer(cause.stdout) &&
      cause.stdout.length >= limit &&
      cause.stderr.length === 0
    )
      return cause.stdout.subarray(0, limit);
    throw error;
  }
}

export function assertRepository(repo) {
  const actual = git(repo, ["rev-parse", "--show-toplevel"]).trim();
  const root = realpathSync.native(actual);
  if (root !== realpathSync.native(repo))
    throw new SetupError("repo must identify the repository root");
  return root;
}
