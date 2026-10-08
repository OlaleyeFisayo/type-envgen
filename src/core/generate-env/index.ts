import { parseEnv } from "node:util";
import { annotatedSchema } from "./annotated-schema.ts";
import { applyTags } from "./apply-tags.ts";
import { JSON_HELPER, TARGETS, type TargetName } from "./constants.ts";
import { inferSchema } from "./infer-schema.ts";
import { prop } from "./prop.ts";
import { readTags } from "./read-tags.ts";

/** Takes the contents of a .env file and returns the source of a typesafe, zod-validated env module. */
export function generateEnv(envSource: string, target: TargetName = "node"): string {
  const { imports, field, source } = TARGETS[target];
  const tagsByKey = readTags(envSource);
  const entries = Object.entries(parseEnv(envSource));
  const fields = entries.map(([key, value = ""]) => {
    const tags = tagsByKey.get(key) ?? {};
    const base = tags.type ? annotatedSchema(tags.type, key, value) : inferSchema(key, value);
    return `  ${prop(field(key))}: ${applyTags(base, tags, key)},`;
  });
  const usesJson = fields.some((f) => f.includes(": json("));

  return [
    `import { z } from "zod";`,
    ...imports,
    "",
    ...(usesJson ? [JSON_HELPER, ""] : []),
    "export const envSchema = z.object({",
    ...fields,
    "});",
    "",
    `export const env = envSchema.parse(${source(entries.map(([key]) => key))});`,
    "export type Env = z.infer<typeof envSchema>;",
    "",
  ].join("\n");
}
