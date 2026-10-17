import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { assetFiles, toolManifest, inside } from "../src/tool-manifest.mjs";
import { git, assertRepository } from "../src/git/commands.mjs";
import { output, publish, saveFailure } from "./run-action.mjs";

export function repositoryPath(workspace, requested) {
  const base = realpathSync.native(workspace),
    repo = assertRepository(resolve(base, requested));
  if (
    !inside(base, repo) ||
    git(repo, ["rev-parse", "--is-inside-work-tree"]).trim() !== "true"
  )
    throw new Error(
      "repository-path must identify a Git checkout inside the workspace",
    );
  return repo;
}
function isolatedEnvironment(directory) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/^(npm_|node_|git_|corepack_|QR_GITHUB_TOKEN$|INIT_CWD$)/i.test(key),
    ),
  );
  const home = join(directory, "home");
  mkdirSync(home);
  const scratch = join(directory, "scratch");
  mkdirSync(scratch);
  const config = join(home, "empty.npmrc");
  writeFileSync(config, "");
  return {
    ...env,
    HOME: home,
    USERPROFILE: home,
    TMPDIR: scratch,
    TMP: scratch,
    TEMP: scratch,
    npm_config_userconfig: config,
    npm_config_globalconfig: join(home, "global.npmrc"),
    npm_config_cache: join(directory, "npm-cache"),
    npm_config_registry: "https://registry.npmjs.org/",
  };
}
export async function withInstalledTool({ actionPath, tempRoot }, callback) {
  const expected = toolManifest(actionPath, false);
  const directory = mkdtempSync(join(tempRoot, "quality-tool-"));
  try {
    const root = join(directory, "tool");
    for (const file of assetFiles(actionPath)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      cpSync(join(actionPath, file), join(root, file));
    }
    if (JSON.stringify(toolManifest(root, false)) !== JSON.stringify(expected))
      throw new Error("Copied tool assets changed");
    const env = isolatedEnvironment(directory);
    const nodeDirectory = dirname(realpathSync(process.execPath));
    const npm =
      process.platform === "win32"
        ? join(nodeDirectory, "node_modules/npm/bin/npm-cli.js")
        : join(nodeDirectory, "../lib/node_modules/npm/bin/npm-cli.js");
    execFileSync(
      process.execPath,
      [
        npm,
        "ci",
        "--ignore-scripts",
        "--omit=dev",
        "--include=optional",
        "--no-audit",
        "--no-fund",
      ],
      {
        cwd: root,
        env,
        timeout: 180000,
        maxBuffer: 4 * 1024 * 1024,
        stdio: "pipe",
        windowsHide: true,
      },
    );
    return await callback({ root, expected, env });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
async function bootstrap() {
  const tempRoot = realpathSync(process.env.RUNNER_TEMP);
  const workspace = realpathSync(process.env.GITHUB_WORKSPACE);
  if (inside(workspace, tempRoot))
    throw new Error("Runner temp must be outside the authored workspace");
  const directory = mkdtempSync(join(tempRoot, "quality-reports-"));
  output("report-directory", directory);
  try {
    const checkout = repositoryPath(workspace, process.env.QR_REPOSITORY_PATH);
    await withInstalledTool(
      { actionPath: process.env.QR_ACTION_PATH, tempRoot },
      async ({ root, expected, env }) => {
        execFileSync(process.execPath, [join(root, "scripts/run-action.mjs")], {
          cwd: root,
          env: {
            ...env,
            QR_EXPECTED_MANIFEST: JSON.stringify(expected),
            QR_REPOSITORY_PATH: checkout,
            QR_REPORT_DIRECTORY: directory,
            QR_TEMP_ROOT: env.TMPDIR,
            QR_GITHUB_TOKEN: process.env.QR_GITHUB_TOKEN,
          },
          timeout: 900000,
          maxBuffer: 4 * 1024 * 1024,
          stdio: "pipe",
          windowsHide: true,
        });
      },
    );
  } catch {
    publish(
      saveFailure(
        directory,
        "Tool installation, checkout validation or execution failed. Rerun the quality check.",
      ),
      directory,
    );
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await bootstrap();
