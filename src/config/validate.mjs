import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { validGlob } from "./glob.mjs";

export class ConfigurationError extends Error {
  constructor(message) {
    super(`Invalid quality-ratchet configuration: ${message}`);
    this.name = "ConfigurationError";
    this.exitCode = 2;
  }
}

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  ownProperties: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
});
ajv.addFormat("repository-glob", { type: "string", validate: validGlob });
const schema = JSON.parse(
  readFileSync(
    new URL("../../schema/quality-ratchet.schema.json", import.meta.url),
    "utf8",
  ),
);
const validate = ajv.compile(schema);

/** @param {unknown} value @returns {import('../contracts.mjs').ConfigInput} */
export function validateConfig(value) {
  if (!validate(value))
    throw new ConfigurationError(
      ajv.errorsText(validate.errors, { separator: "; " }),
    );
  return value;
}
