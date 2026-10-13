import { describe, expect, it } from "vitest";
import type { TargetName } from "../../constants/index.ts";
import { generateEnv } from "../../generate-env/index.ts";
import { updateEnv } from "../../generate-env/update-env.ts";

const gen = (env: string, target: TargetName = "node") => generateEnv(env, target);
const update = (existing: string, env: string, target: TargetName = "node") =>
  updateEnv(existing, gen(env, target), "env.ts");

// A generated file with user code above, between and below the generated regions.
function customized(env: string, target: TargetName = "node") {
  return gen(env, target)
    .replace(
      "\n\nexport const envSchema",
      '\nimport { helper } from "./helper";\n// user comment\n\nexport const envSchema',
    )
    .replace("});\n\nexport const env", "});\n\nconst between = 1;\n\nexport const env")
    .concat("export const isProd = env.NODE_ENV === 'production';\n");
}

describe("updateEnv", () => {
  it("is a no-op when nothing changed", () => {
    expect(update(gen("PORT=1"), "PORT=1")).toBe(gen("PORT=1"));
    const file = customized("PORT=1");
    expect(update(file, "PORT=1")).toBe(file);
  });

  it("refreshes the schema and keeps user code", () => {
    expect(update(customized("PORT=1"), "PORT=1\nDEBUG=true")).toBe(customized("PORT=1\nDEBUG=true"));
    expect(update(customized("PORT=1\nDEBUG=true"), "PORT=1")).toBe(customized("PORT=1"));
  });

  it("toggles the json import with JSON values", () => {
    const withJson = update(gen("PORT=1"), 'PORT=1\nX={"a":1}');
    expect(withJson).toContain(`import { json, validateEnv } from "type-envgen";`);
    expect(update(withJson, "PORT=1")).toContain(`import { validateEnv } from "type-envgen";`);
  });

  it("refreshes the nextjs key list", () => {
    const out = update(gen("NEXT_PUBLIC_A=1", "nextjs"), "NEXT_PUBLIC_A=1\nNEXT_PUBLIC_B=2", "nextjs");
    expect(out).toBe(gen("NEXT_PUBLIC_A=1\nNEXT_PUBLIC_B=2", "nextjs"));
  });

  it("swaps target imports when the target changes", () => {
    const svelte = update(customized("PUBLIC_A=1"), "PUBLIC_A=1", "sveltekit");
    expect(svelte).toBe(customized("PUBLIC_A=1", "sveltekit"));
    expect(update(svelte, "PUBLIC_A=1")).toBe(customized("PUBLIC_A=1"));
  });

  it("keeps CRLF line endings", () => {
    const crlf = customized("PORT=1").replace(/\n/g, "\r\n");
    expect(update(crlf, "PORT=1\nDEBUG=true")).toBe(customized("PORT=1\nDEBUG=true").replace(/\n/g, "\r\n"));
  });

  it("upgrades a type-envgen 1.2 file", () => {
    const legacy = `import { z } from "zod";

const json = <T extends z.ZodType>(schema: T) =>
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
    .pipe(schema);

export const envSchema = z.object({
  X: json(z.object({ a: z.number() })),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
`;
    expect(update(legacy, 'X={"a":1}')).toBe(gen('X={"a":1}'));
  });

  it("refuses a file without the generated regions", () => {
    expect(() => update("export const foo = 1;\n", "PORT=1")).toThrow(
      `Can't update env.ts: no "export const envSchema = z.object({" found. Delete the file to regenerate it.`,
    );
  });
});
