import { z } from "zod";

export const json = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: "must be valid JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);
