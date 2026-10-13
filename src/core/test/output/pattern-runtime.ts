import { z } from "zod";
import { validateEnv } from "type-envgen";

export const envSchema = z.object({
  OPTIONAL_SLUG: z.string().regex(/^[a-z]+$/).optional(),
  STRIPE_KEY: z.string().regex(/^sk_(live|test)_[A-Za-z0-9]+$/),
});

export const env = validateEnv(envSchema, process.env);
export type Env = z.infer<typeof envSchema>;
