import { globSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = globSync("test/**/*.test.mjs", {
  exclude: ["test/fixtures/**", "test/helpers/**"],
}).sort();
if (files.length === 0) throw new Error("No test files found");
const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
