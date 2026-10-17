import { readFileSync } from "node:fs";
import { decodeScanContext } from "../contracts.mjs";
/** Each scanner emits one report and a measured exit; aggregate policy owns advisories. */
export async function runScannerEntry(name, scan) {
  try {
    const report = await scan(decodeScanContext(readFileSync(0, "utf8")));
    if (!Array.isArray(report?.findings))
      throw new Error("Scanner returned invalid findings");
    process.stdout.write(JSON.stringify(report) + "\n");
    process.exitCode = report.findings.length ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${name}: ${error.message}\n`);
    process.exitCode = 2;
  }
}
