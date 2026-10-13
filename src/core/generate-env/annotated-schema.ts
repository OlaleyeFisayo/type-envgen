import { TYPES } from "../constants/index.ts";
import { jsonSchema } from "./json-schema.ts";

export function annotatedSchema(type: string, key: string, value: string): string {
  const enumValues = type.match(/^enum\((.*)\)$/i)?.[1];
  if (enumValues !== undefined) {
    const values = enumValues
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length) return `z.enum(${JSON.stringify(values)})`;
  }
  const uuidVersion = type
    .match(/^uuid\((.*)\)$/i)?.[1]
    ?.trim()
    .toLowerCase();
  if (uuidVersion !== undefined) {
    if (/^v[1-8]$/.test(uuidVersion)) {
      return `z.uuid({ version: "${uuidVersion}" })`;
    }
    throw new Error(`Invalid UUID version "${uuidVersion}" for ${key} (expected v1 to v8)`);
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
