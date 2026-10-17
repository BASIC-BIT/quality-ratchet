import { FORMATS, getFormatByFile } from "@jscpd/tokenizer";
import schema from "../../schema/quality-ratchet.schema.json" with { type: "json" };

// Native jscpd --list owns accepted names; Task 4 verifies actual path detection.
export const supportedFormats = Object.freeze(
  schema.definitions.supportedFormat.enum,
);
export const formatExtensions = Object.freeze(
  Object.fromEntries(
    supportedFormats.map((name) => [
      name,
      Object.freeze(
        name === "markdown"
          ? [...FORMATS[name].exts, "mdx"]
          : [...(FORMATS[name]?.exts ?? [])],
      ),
    ]),
  ),
);
export function formatForPath(path) {
  return path.endsWith(".mdx") ? "markdown" : (getFormatByFile(path) ?? null);
}
