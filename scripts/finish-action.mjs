import { readFileSync } from "node:fs";
import { join } from "node:path";
const limit = 500;
/**
 * Control characters are stripped and the verdict is emitted as one line behind
 * a fixed prefix, so no emitted line can begin with `::` and a verdict cannot
 * forge a workflow command. Truncation is stated rather than silent.
 */
const plain = (value) => {
  const text = String(value).replace(/[\p{Cc}\p{Cf}]/gu, " ");
  return text.length <= limit
    ? text
    : text.slice(0, limit) + " [truncated; full text in the evidence artifact]";
};
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
  const verdict = `Quality ratchet outcome: ${plain(result.outcome)} - ${plain(result.message)}`;
  if (result.exitCode === 0) console.log(verdict);
  else console.error(verdict);
  process.exitCode = result.exitCode;
} catch {
  console.error("The saved quality verdict is unavailable or invalid.");
  process.exitCode = 2;
}
