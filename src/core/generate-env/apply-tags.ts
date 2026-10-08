import { z } from "zod";
import type { Tags } from "./read-tags.ts";

export function applyTags(base: string, tags: Tags, key: string): string {
  if (tags.unknown) throw new Error(`Unknown tag @${tags.unknown} for ${key}`);
  if (tags.default !== undefined && tags.optional) {
    throw new Error(`Cannot combine @default and @optional for ${key}`);
  }

  let schema = base;
  const bounds = { min: tags.min, max: tags.max };
  const parsed: Partial<Record<"min" | "max", number>> = {};
  for (const [name, raw] of Object.entries(bounds) as ["min" | "max", string | undefined][]) {
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) throw new Error(`@${name} for ${key} must be a number, got "${raw}"`);
    // Numbers bound the value, string formats bound the length.
    if (!/^z\.(coerce\.number|string|url|email|uuid)\(/.test(base)) {
      throw new Error(`@${name} is not supported for ${key} (${base})`);
    }
    parsed[name] = n;
    schema += `.${name}(${n})`;
  }
  if (parsed.min !== undefined && parsed.max !== undefined && parsed.min > parsed.max) {
    throw new Error(`@min (${parsed.min}) is greater than @max (${parsed.max}) for ${key}`);
  }

  if (tags.default !== undefined) {
    schema += formatDefault(base, tags.default, key, parsed);
  }

  return tags.optional ? `${schema}.optional()` : schema;
}

const FORMATS: [string, z.ZodType, string][] = [
  ["z.iso.datetime()", z.iso.datetime(), "ISO datetime"],
  ["z.iso.date()", z.iso.date(), "ISO date"],
  ["z.ipv4()", z.ipv4(), "IPv4 address"],
  ["z.ipv6()", z.ipv6(), "IPv6 address"],
];

function formatDefault(
  base: string,
  rawInput: string,
  key: string,
  bounds: Partial<Record<"min" | "max", number>>,
): string {
  if (!rawInput.trim() && rawInput === "") {
    throw new Error(`@default for ${key} requires a value`);
  }

  let raw = rawInput.trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    raw = raw.slice(1, -1);
  }

  // Integer
  if (base.includes("z.coerce.number().int()")) {
    const n = Number(raw);
    if (!raw || !Number.isInteger(n)) {
      throw new Error(`@default for ${key} must be an integer, got "${rawInput}"`);
    }
    if (bounds.min !== undefined && n < bounds.min) {
      throw new Error(`@default (${n}) is less than @min (${bounds.min}) for ${key}`);
    }
    if (bounds.max !== undefined && n > bounds.max) {
      throw new Error(`@default (${n}) is greater than @max (${bounds.max}) for ${key}`);
    }
    return `.default(${n})`;
  }

  // Float/number
  if (base.includes("z.coerce.number()")) {
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) {
      throw new Error(`@default for ${key} must be a number, got "${rawInput}"`);
    }
    if (bounds.min !== undefined && n < bounds.min) {
      throw new Error(`@default (${n}) is less than @min (${bounds.min}) for ${key}`);
    }
    if (bounds.max !== undefined && n > bounds.max) {
      throw new Error(`@default (${n}) is greater than @max (${bounds.max}) for ${key}`);
    }
    return `.default(${n})`;
  }

  // Boolean
  if (base.includes("z.stringbool()")) {
    if (/^(true|1)$/i.test(raw)) return ".default(true)";
    if (/^(false|0)$/i.test(raw)) return ".default(false)";
    throw new Error(`@default for ${key} must be a boolean (true/false/1/0), got "${rawInput}"`);
  }

  // URL
  if (base.includes("z.url()")) {
    if (!z.url().safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid URL, got "${rawInput}"`);
    }
    return `.default(${JSON.stringify(raw)})`;
  }

  // Email
  if (base.includes("z.email()")) {
    if (!z.email().safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid email, got "${rawInput}"`);
    }
    return `.default(${JSON.stringify(raw)})`;
  }

  // UUID
  if (base.includes("z.uuid()")) {
    if (!z.uuid().safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid UUID, got "${rawInput}"`);
    }
    return `.default(${JSON.stringify(raw)})`;
  }

  // Date / datetime / IP
  const format = FORMATS.find(([prefix]) => base.startsWith(prefix));
  if (format) {
    const [, schema, label] = format;
    if (!schema.safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid ${label}, got "${rawInput}"`);
    }
    return `.default(${JSON.stringify(raw)})`;
  }

  // Enum
  const enumMatch = base.match(/^z\.enum\((\[.*?\])\)/);
  if (enumMatch) {
    const allowed: string[] = JSON.parse(enumMatch[1]);
    if (!allowed.includes(raw)) {
      throw new Error(`@default "${raw}" for ${key} is not in enum (${allowed.join(", ")})`);
    }
    return `.default(${JSON.stringify(raw)})`;
  }

  // JSON
  if (base.startsWith("json(")) {
    try {
      JSON.parse(raw);
    } catch {
      throw new Error(`@default for ${key} must be valid JSON, got "${rawInput}"`);
    }
    return `.default(${raw})`;
  }

  // Default string
  if (bounds.min !== undefined && raw.length < bounds.min) {
    throw new Error(`@default length (${raw.length}) is less than @min (${bounds.min}) for ${key}`);
  }
  if (bounds.max !== undefined && raw.length > bounds.max) {
    throw new Error(`@default length (${raw.length}) is greater than @max (${bounds.max}) for ${key}`);
  }
  return `.default(${JSON.stringify(raw)})`;
}
