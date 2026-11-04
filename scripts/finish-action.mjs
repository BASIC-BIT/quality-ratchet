import { readFileSync } from "node:fs";
import { join } from "node:path";
/** Control characters are stripped so a verdict cannot forge a workflow command. */
const plain = (value) =>
  String(value)
    .slice(0, 500)
    .replace(/[\p{Cc}\p{Cf}]/gu, " ");
try {
  const { result } = JSON.parse(
    readFileSync(
      join(process.env.QR_REPORT_DIRECTORY, "quality-evidence.json"),
      "utf8",
    ),
  );
  if (![0, 1, 2].includes(result.exitCode)) throw new Error();
  if (typeof result.outcome !== "string" || typeof result.message !== "string")
    throw new Error();
  const verdict = `Quality ratchet outcome: ${plain(result.outcome)}\n${plain(result.message)}`;
  if (result.exitCode === 0) console.log(verdict);
  else console.error(verdict);
  process.exitCode = result.exitCode;
} catch {
  console.error("The saved quality verdict is unavailable or invalid.");
  process.exitCode = 2;
}
