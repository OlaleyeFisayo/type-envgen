import { parseEnv } from "node:util";
import { annotatedSchema } from "./annotated-schema.ts";
import { applyTags } from "./apply-tags.ts";
import { JSON_HELPER } from "./constants.ts";
import { inferSchema } from "./infer-schema.ts";
import { prop } from "./prop.ts";
import { readTags } from "./read-tags.ts";

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
