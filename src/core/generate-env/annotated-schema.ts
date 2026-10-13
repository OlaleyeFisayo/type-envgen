import { TYPES } from "../constants/index.ts";
import { jsonSchema } from "./json-schema.ts";

const EMAIL_PRESETS: Record<string, string> = {
  html5: "html5Email",
  rfc5322: "rfc5322Email",
  unicode: "unicodeEmail",
  browser: "browserEmail",
};

export function annotatedSchema(type: string, key: string, value: string): string {
  const enumValues = type.match(/^enum\((.*)\)$/i)?.[1];
  if (enumValues !== undefined) {
    const values = enumValues
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length) return `z.enum(${JSON.stringify(values)})`;
  }
  const emailPreset = type
    .match(/^email\((.*)\)$/i)?.[1]
    ?.trim()
    .toLowerCase();
  if (emailPreset !== undefined) {
    const pattern = EMAIL_PRESETS[emailPreset];
    if (pattern) {
      return `z.email({ pattern: z.regexes.${pattern} })`;
    }
    const valid = Object.keys(EMAIL_PRESETS).join(", ");
    throw new Error(`Invalid email preset "${emailPreset}" for ${key} (expected one of: ${valid})`);
  }
  const name = type.toLowerCase();
  if (name in TYPES) return TYPES[name];
  if (name === "json") {
    try {
      return `json(${jsonSchema(JSON.parse(value))})`;
    } catch {
      return "json(z.unknown())";
    }
  }
  throw new Error(`Unknown @type "${type}" for ${key}`);
}
