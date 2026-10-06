import { parseEnv } from "node:util";
import { z } from "zod";

const NODE_ENVS = ["development", "production", "test"];

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
  if (value.includes("${")) return "z.string()"; // ponytail: references aren't resolved, so the real format is unknown
  if (/^(true|false)$/i.test(value)) return "z.stringbool()";
  // ponytail: z.coerce.number() turns "" into 0; switch to a stricter number pipe if that bites
  if (/^-?\d+$/.test(value)) return "z.coerce.number().int()";
  if (/^-?\d*\.\d+$/.test(value)) return "z.coerce.number()";
  if (value.includes("://") && z.url().safeParse(value).success) return "z.url()";
  if (z.uuid().safeParse(value).success) return "z.uuid()";
  if (z.email().safeParse(value).success) return "z.email()";
  if (/^[[{]/.test(value)) {
    try {
      return `json(${jsonSchema(JSON.parse(value))})`;
    } catch {}
  }
  return "z.string()";
}

/** Takes the contents of a .env file and returns the source of a typesafe, zod-validated env module. */
export function generateEnv(envSource: string): string {
  const fields = Object.entries(parseEnv(envSource)).map(
    ([key, value = ""]) => `  ${prop(key)}: ${inferSchema(key, value)},`,
  );
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
