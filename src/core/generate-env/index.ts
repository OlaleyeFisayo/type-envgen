import { parseEnv } from "node:util";
import { z } from "zod";

const NODE_ENVS = ["development", "production", "test"];

// Schemas for each `# @type` name; inference reuses them so the two paths can't drift.
const TYPES: Record<string, string> = {
  string: "z.string()",
  number: "z.coerce.number()",
  int: "z.coerce.number().int()",
  boolean: "z.stringbool()",
  url: "z.url()",
  email: "z.email()",
  uuid: "z.uuid()",
};

// Emitted into the generated file only when a JSON value is present.
const JSON_HELPER = `const json = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);`;

const prop = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key));

function jsonSchema(value: unknown): string {
  if (value === null) return "z.null()";
  if (Array.isArray(value)) {
    const items = [...new Set(value.map(jsonSchema))];
    if (items.length === 0) return "z.array(z.unknown())";
    return `z.array(${items.length === 1 ? items[0] : `z.union([${items.join(", ")}])`})`;
  }
  if (typeof value === "object") {
    const fields = Object.entries(value).map(([k, v]) => `${prop(k)}: ${jsonSchema(v)}`);
    return `z.object({ ${fields.join(", ")} })`;
  }
  return `z.${typeof value}()`; // string | number | boolean
}

// Order matters: first match wins. Format checks use zod itself so the schema always accepts its own sample.
function inferSchema(key: string, value: string): string {
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

type Tags = { type?: string; optional?: boolean; required?: boolean; min?: string; max?: string; unknown?: string };

// parseEnv drops comments, so "# @tag" lines are read with a separate line scan.
// Tags apply to the next key line; a blank line in between cancels them.
// Raw text only: validation happens per key so errors can name it.
function readTags(envSource: string): Map<string, Tags> {
  const tagsByKey = new Map<string, Tags>();
  let pending: Tags = {};
  for (const line of envSource.split(/\r?\n/)) {
    const tag = line.match(/^\s*#\s*@(\w+)(?:\s+(.+?))?\s*$/);
    if (tag) {
      const [, name, arg = ""] = tag;
      if (name === "type" || name === "min" || name === "max") pending[name] = arg;
      else if (name === "optional" || name === "required") pending[name] = true;
      else pending.unknown = name;
    } else if (!line.trim()) pending = {};
    else {
      const key = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=/)?.[1];
      if (key) {
        tagsByKey.set(key, pending);
        pending = {};
      }
    }
  }
  return tagsByKey;
}

function applyTags(base: string, tags: Tags, key: string): string {
  if (tags.unknown) throw new Error(`Unknown tag @${tags.unknown} for ${key}`);
  if (tags.optional && tags.required) throw new Error(`${key} cannot be both @optional and @required`);

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

function annotatedSchema(type: string, key: string, value: string): string {
  const enumValues = type.match(/^enum\((.*)\)$/i)?.[1];
  if (enumValues !== undefined) {
    const values = enumValues.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length) return `z.enum(${JSON.stringify(values)})`;
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

/** Takes the contents of a .env file and returns the source of a typesafe, zod-validated env module. */
export function generateEnv(envSource: string): string {
  const tagsByKey = readTags(envSource);
  const fields = Object.entries(parseEnv(envSource)).map(([key, value = ""]) => {
    const tags = tagsByKey.get(key) ?? {};
    const base = tags.type ? annotatedSchema(tags.type, key, value) : inferSchema(key, value);
    return `  ${prop(key)}: ${applyTags(base, tags, key)},`;
  });
  const usesJson = fields.some((f) => f.includes(": json("));

  return [
    `import { z } from "zod";`,
    "",
    ...(usesJson ? [JSON_HELPER, ""] : []),
    "export const envSchema = z.object({",
    ...fields,
    "});",
    "",
    "export const env = envSchema.parse(process.env);",
    "export type Env = z.infer<typeof envSchema>;",
    "",
  ].join("\n");
}
