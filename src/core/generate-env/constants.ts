export const NODE_ENVS = ["development", "production", "test"];

// Schemas for each `# @type` name; inference reuses them so the two paths can't drift.
export const TYPES: Record<string, string> = {
  string: "z.string()",
  number: "z.coerce.number()",
  int: "z.coerce.number().int()",
  boolean: "z.stringbool()",
  url: "z.url()",
  email: "z.email()",
  uuid: "z.uuid()",
};

// Emitted into the generated file only when a JSON value is present.
export const JSON_HELPER = `const json = <T extends z.ZodType>(schema: T) =>
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
