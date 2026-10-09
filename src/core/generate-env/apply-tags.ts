import { z } from "zod";
import type { Tags } from "./read-tags.ts";

export type Bounds = {
  min?: number;
  max?: number;
  minTag?: "min" | "minlength";
  maxTag?: "max" | "maxlength";
};

const STRING_LIKE_REGEX = /^z\.(string|url|email|uuid|iso\.date|iso\.datetime|ipv4|ipv6)\(/;
const NUMBER_REGEX = /^z\.coerce\.number\(/;

function parseBound(
  raw: string,
  tag: "min" | "max" | "minlength" | "maxlength",
  key: string,
  isStringLike: boolean,
): number {
  if (isStringLike) {
    const trimmed = raw.trim();
    const n = Number(trimmed);
    if (!trimmed || !/^\d+$/.test(trimmed) || !Number.isSafeInteger(n) || n < 0) {
      throw new Error(`@${tag} for ${key} must be a non-negative integer, got "${raw}"`);
    }
    return n;
  }
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) {
    throw new Error(`@${tag} for ${key} must be a number, got "${raw}"`);
  }
  return n;
}

export function applyTags(base: string, tags: Tags, key: string): string {
  if (tags.unknown) throw new Error(`Unknown tag @${tags.unknown} for ${key}`);
  if (tags.default !== undefined && tags.optional) {
    throw new Error(`Cannot combine @default and @optional for ${key}`);
  }

  const isStringLike = STRING_LIKE_REGEX.test(base);
  const isNumber = NUMBER_REGEX.test(base);

  if (tags.min !== undefined && tags.minlength !== undefined) {
    throw new Error(`Cannot combine @min and @minlength for ${key}`);
  }
  if (tags.max !== undefined && tags.maxlength !== undefined) {
    throw new Error(`Cannot combine @max and @maxlength for ${key}`);
  }

  if (tags.minlength !== undefined && !isStringLike) {
    throw new Error(`@minlength is not supported for ${key} (${base})`);
  }
  if (tags.maxlength !== undefined && !isStringLike) {
    throw new Error(`@maxlength is not supported for ${key} (${base})`);
  }
  if (tags.min !== undefined && !isNumber && !isStringLike) {
    throw new Error(`@min is not supported for ${key} (${base})`);
  }
  if (tags.max !== undefined && !isNumber && !isStringLike) {
    throw new Error(`@max is not supported for ${key} (${base})`);
  }

  const bounds: Bounds = {};

  const minRaw = tags.minlength ?? tags.min;
  const minTag = tags.minlength !== undefined ? "minlength" : "min";
  if (minRaw !== undefined) {
    bounds.min = parseBound(minRaw, minTag, key, isStringLike);
    bounds.minTag = minTag;
  }

  const maxRaw = tags.maxlength ?? tags.max;
  const maxTag = tags.maxlength !== undefined ? "maxlength" : "max";
  if (maxRaw !== undefined) {
    bounds.max = parseBound(maxRaw, maxTag, key, isStringLike);
    bounds.maxTag = maxTag;
  }

  if (bounds.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max) {
    throw new Error(`@${bounds.minTag} (${bounds.min}) is greater than @${bounds.maxTag} (${bounds.max}) for ${key}`);
  }

  let schema = base;
  if (bounds.min !== undefined) {
    schema += `.min(${bounds.min})`;
  }
  if (bounds.max !== undefined) {
    schema += `.max(${bounds.max})`;
  }

  if (tags.default !== undefined) {
    schema += formatDefault(base, tags.default, key, bounds);
  }

  return tags.optional ? `${schema}.optional()` : schema;
}

const FORMATS: [string, z.ZodType, string][] = [
  ["z.iso.datetime()", z.iso.datetime(), "ISO datetime"],
  ["z.iso.date()", z.iso.date(), "ISO date"],
  ["z.ipv4()", z.ipv4(), "IPv4 address"],
  ["z.ipv6()", z.ipv6(), "IPv6 address"],
];

function checkStringBounds(raw: string, bounds: Bounds, key: string) {
  if (bounds.min !== undefined && raw.length < bounds.min) {
    throw new Error(
      `@default length (${raw.length}) is less than @${bounds.minTag ?? "min"} (${bounds.min}) for ${key}`,
    );
  }
  if (bounds.max !== undefined && raw.length > bounds.max) {
    throw new Error(
      `@default length (${raw.length}) is greater than @${bounds.maxTag ?? "max"} (${bounds.max}) for ${key}`,
    );
  }
}

function formatDefault(base: string, rawInput: string, key: string, bounds: Bounds): string {
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
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Email
  if (base.includes("z.email()")) {
    if (!z.email().safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid email, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // UUID
  if (base.includes("z.uuid()")) {
    if (!z.uuid().safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid UUID, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Date / datetime / IP
  const format = FORMATS.find(([prefix]) => base.startsWith(prefix));
  if (format) {
    const [, schema, label] = format;
    if (!schema.safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid ${label}, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
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
  checkStringBounds(raw, bounds, key);
  return `.default(${JSON.stringify(raw)})`;
}
