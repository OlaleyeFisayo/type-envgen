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
  const timeParam = type.match(/^time\((.*)\)$/i)?.[1]?.trim();
  if (timeParam !== undefined) {
    const match = timeParam.match(/^(?:precision\s*=\s*)?(\d+)$/i);
    if (match) {
      const precision = Number.parseInt(match[1], 10);
      return `z.iso.time({ precision: ${precision} })`;
    }
    throw new Error(`Invalid time parameter "${timeParam}" for ${key} (expected precision=<number>)`);
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
