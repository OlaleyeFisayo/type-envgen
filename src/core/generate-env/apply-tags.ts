import type { Tags } from "./read-tags.ts";

export function applyTags(base: string, tags: Tags, key: string): string {
  if (tags.unknown) throw new Error(`Unknown tag @${tags.unknown} for ${key}`);
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
  return tags.optional ? `${schema}.optional()` : schema;
}
