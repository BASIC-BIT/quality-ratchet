import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { join, relative, isAbsolute, sep } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

export const toolAssets = [
  "src",
  "bin",
  "schema",
  "scripts/bootstrap-tool.mjs",
  "scripts/run-action.mjs",
  "scripts/finish-action.mjs",
  "package.json",
  "package-lock.json",
  ".nvmrc",
  "LICENSE",
  "NOTICE",
];
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function inside(parent, child) {
  const path = relative(parent, child);
  return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
}
export function assetFiles(root, paths = toolAssets) {
  return paths.flatMap((path) => {
    const stat = lstatSync(join(root, path));
    if (stat.isSymbolicLink())
      throw new Error("Tool assets cannot be symlinks");
    if (stat.isDirectory())
      return assetFiles(
        root,
        readdirSync(join(root, path))
          .sort()
          .map((name) => `${path}/${name}`),
      );
    if (!stat.isFile()) throw new Error("Tool asset is not a file");
    return [path];
  });
}
export function toolManifest(root, installed = true) {
  const pkg = json(join(root, "package.json"));
  const lock = json(join(root, "package-lock.json"));
  if (
    installed &&
    !inside(realpathSync(root), realpathSync(join(root, "node_modules")))
  )
    throw new Error("Dependencies outside tool installation");
  const scanners = {};
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    if (
      lock.packages[""].dependencies[name] !== version ||
      lock.packages[`node_modules/${name}`].version !== version
    )
      throw new Error("Package and lockfile versions differ");
    if (
      installed &&
      !inside(
        realpathSync(join(root, "node_modules")),
        realpathSync(join(root, "node_modules", name)),
      )
    )
      throw new Error("Dependency outside tool installation");
    scanners[name] = installed
      ? json(join(root, "node_modules", name, "package.json")).version
      : version;
  }
  const files = assetFiles(root).map((path) => [
    path,
    digest(readFileSync(join(root, path))),
  ]);
  return {
    schemaVersion: 1,
    version: pkg.version,
    node: process.versions.node,
    supportedNode: pkg.engines.node,
    minimumNode: readFileSync(join(root, ".nvmrc"), "utf8").trim(),
    scanners,
    lockHash: digest(readFileSync(join(root, "package-lock.json"))),
    assetHash: digest(JSON.stringify(files)),
  };
}
export async function verifyInstalledTool(root, expected) {
  const manifest = toolManifest(root);
  if (JSON.stringify(manifest) !== JSON.stringify(expected))
    throw new Error("Installed tool does not match pinned assets");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (
    major !== 24 ||
    minor < 15 ||
    manifest.minimumNode !== "24.15.0" ||
    manifest.supportedNode !== ">=24.15.0 <25"
  )
    throw new Error("Unsupported tool runtime");
  const require = createRequire(join(root, "package.json"));
  const { getPlatformKey, PLATFORM_MAP } = require(
    join(root, "node_modules/jscpd/platform-map.js"),
  );
  const native = PLATFORM_MAP[getPlatformKey()].packageName;
  const nativePath = realpathSync(join(root, "node_modules", native));
  const lock = json(join(root, "package-lock.json"));
  if (
    !inside(realpathSync(join(root, "node_modules")), nativePath) ||
    json(join(nativePath, "package.json")).version !==
      lock.packages[`node_modules/${native}`].version
  )
    throw new Error("Native scanner does not match lockfile");
  const version = execFileSync(
    process.execPath,
    [join(root, "node_modules/jscpd/run-jscpd.js"), "--version"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
      windowsHide: true,
      env: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !/^NODE_/i.test(key)),
      ),
    },
  ).trim();
  if (!version.includes(manifest.scanners.jscpd))
    throw new Error("Native scanner is unavailable");
  const { makeLinter, lintSource } = await import(
    pathToFileURL(join(root, "src/complexity/identity.mjs"))
  );
  const functions = await lintSource(
    makeLinter(root, root),
    "export function available(value: boolean) { if (value) return 1; return 0; }",
    join(root, "probe.ts"),
  );
  if (functions.length !== 1 || functions[0].cyclomatic !== 2)
    throw new Error("Parser or complexity scanner is unavailable");
  await import(pathToFileURL(join(root, "src/duplication/scanner.mjs")));
  const { physicalLines } = await import(
    pathToFileURL(join(root, "src/scanners/file-size.mjs"))
  );
  if (physicalLines("one\ntwo\n") !== 2)
    throw new Error("File-size scanner is unavailable");
  return manifest;
}
