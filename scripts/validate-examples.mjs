import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { resolvePolicy } from "../src/config/resolve.mjs";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
for (const path of ["quality-ratchet.json", ...globSync("examples/*.json")])
  resolvePolicy(read(path));
const pkg = read("package.json"),
  lock = read("package-lock.json");
assert.equal(pkg.version, lock.version);
assert.equal(pkg.version, lock.packages[""].version);
assert.equal(pkg.engines.node, ">=24.15.0 <25");
const workflow = readFileSync("examples/code-quality.yml", "utf8");
const releasePin = workflow.match(
  /BASIC-BIT\/quality-ratchet@([a-f0-9]{40}) # v(\d+\.\d+\.\d+)(?=\s|$)/,
);
assert.ok(releasePin, "Adoption template needs a full SHA and release version");
if (process.argv.includes("--release"))
  assert.equal(
    releasePin[2],
    pkg.version,
    "Release template version must match package version",
  );
console.log(
  "Schema, policy examples, package versions and adoption template valid.",
);
