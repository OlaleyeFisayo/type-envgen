import { z } from "zod";
import { validateEnv } from "type-envgen";

export const envSchema = z.object({
  ONLY_ONE_KEY: z.coerce.number().int(),
});

export const env = validateEnv(envSchema, process.env);
export type Env = z.infer<typeof envSchema>;
