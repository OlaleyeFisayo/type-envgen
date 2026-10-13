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
  const datetimeMatch = type.match(/^datetime\((.*)\)$/i);
  if (datetimeMatch) {
    const rawOptions = datetimeMatch[1].trim();
    if (!rawOptions) {
      throw new Error(`@type datetime requires options for ${key}`);
    }
    const parts = rawOptions
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      throw new Error(`@type datetime requires options for ${key}`);
    }
    let offset = false;
    let local = false;
    let precision: number | undefined;

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower === "offset") {
        offset = true;
      } else if (lower === "local") {
        local = true;
      } else if (/^precision\s*=\s*/i.test(part)) {
        const valStr = part.replace(/^precision\s*=\s*/i, "").trim();
        const n = Number(valStr);
        if (!valStr || !/^\d+$/.test(valStr) || !Number.isSafeInteger(n) || n < 0) {
          throw new Error(`Invalid precision "${valStr}" in @type datetime for ${key}`);
        }
        precision = n;
      } else {
        throw new Error(`Unknown parameter "${part}" in @type datetime for ${key}`);
      }
    }

    const opts: string[] = [];
    if (offset) opts.push("offset: true");
    if (local) opts.push("local: true");
    if (precision !== undefined) opts.push(`precision: ${precision}`);

    if (opts.length === 0) {
      return "z.iso.datetime()";
    }
    return `z.iso.datetime({ ${opts.join(", ")} })`;
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
