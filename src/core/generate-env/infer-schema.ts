import { z } from "zod";
import { NODE_ENVS, TYPES } from "./constants.ts";
import { jsonSchema } from "./json-schema.ts";

// Order matters: first match wins. Format checks use zod itself so the schema always accepts its own sample.
export function inferSchema(key: string, value: string): string {
  if (key === "NODE_ENV") return `z.enum(${JSON.stringify([...new Set([...NODE_ENVS, value])])})`;
  if (value.includes("${")) return TYPES.string; // ponytail: references aren't resolved, so the real format is unknown
  if (/^(true|false)$/i.test(value)) return TYPES.boolean;
  // ponytail: z.coerce.number() turns "" into 0; switch to a stricter number pipe if that bites
  if (/^-?\d+$/.test(value)) return TYPES.int;
  if (/^-?\d*\.\d+$/.test(value)) return TYPES.number;
  if (value.includes("://") && z.url().safeParse(value).success) return TYPES.url;
  if (z.uuid().safeParse(value).success) return TYPES.uuid;
  if (z.email().safeParse(value).success) return TYPES.email;
  if (/^[[{]/.test(value)) {
    try {
      return `json(${jsonSchema(JSON.parse(value))})`;
    } catch {}
  }
  return TYPES.string;
}
