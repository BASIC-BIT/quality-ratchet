import { runScannerEntry } from "./entry.mjs";
import { scanDuplication } from "../duplication/scanner.mjs";
await runScannerEntry("duplication", scanDuplication);
