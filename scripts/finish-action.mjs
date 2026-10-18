import { readFileSync } from "node:fs";
import { join } from "node:path";
try {
  const { result } = JSON.parse(
    readFileSync(
      join(process.env.QR_REPORT_DIRECTORY, "quality-evidence.json"),
      "utf8",
    ),
  );
  if (![0, 1, 2].includes(result.exitCode)) throw new Error();
  process.exitCode = result.exitCode;
} catch {
  console.error("The saved quality verdict is unavailable or invalid.");
  process.exitCode = 2;
}
