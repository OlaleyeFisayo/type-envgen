import { prop } from "./prop.ts";

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
  date: "z.iso.date()",
  datetime: "z.iso.datetime()",
  ipv4: "z.ipv4()",
  ipv6: "z.ipv6()",
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

const camel = (s: string) => s.toLowerCase().replace(/_+([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const dotted = (key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key) ? `process.env.${key}` : `process.env[${JSON.stringify(key)}]`;
const same = (key: string) => key;

export type TargetName = keyof typeof TARGETS;

// Where the generated module reads its values from. `prefix` is what the bundler/framework
// exposes to the browser (empty = server only); `field` renames schema keys; `source` is the
// expression passed to `envSchema.parse`.
export const TARGETS = {
  node: {
    hint: "Server-side apps and scripts. Reads process.env.",
    prefix: "",
    imports: [] as string[],
    field: same,
    source: (_keys: string[]) => "process.env",
  },
  vite: {
    hint: "Browser apps built with Vite. Reads import.meta.env; only VITE_* keys are exposed.",
    prefix: "VITE_",
    imports: [] as string[],
    field: same,
    source: (_keys: string[]) => "import.meta.env",
  },
  nextjs: {
    hint: "Next.js client components. Lists each NEXT_PUBLIC_* key explicitly, because Next only inlines literal process.env.KEY references.",
    prefix: "NEXT_PUBLIC_",
    imports: [] as string[],
    field: same,
    source: (keys: string[]) => `{\n${keys.map((k) => `  ${prop(k)}: ${dotted(k)},`).join("\n")}\n}`,
  },
  astro: {
    hint: "Astro. Reads import.meta.env; only PUBLIC_* keys are exposed to the client.",
    prefix: "PUBLIC_",
    imports: [] as string[],
    field: same,
    source: (_keys: string[]) => "import.meta.env",
  },
  sveltekit: {
    hint: "SvelteKit. Reads $env/dynamic/public; only PUBLIC_* keys are exposed to the client.",
    prefix: "PUBLIC_",
    imports: [`import { env as publicEnv } from "$env/dynamic/public";`],
    field: same,
    source: (_keys: string[]) => "publicEnv",
  },
  nuxt: {
    hint: "Nuxt. Reads useRuntimeConfig().public; NUXT_PUBLIC_API_URL becomes the camelCase key apiUrl.",
    prefix: "NUXT_PUBLIC_",
    imports: [`import { useRuntimeConfig } from "#imports";`],
    field: (key: string) => camel(key.replace(/^NUXT_PUBLIC_/, "")),
    source: (_keys: string[]) => "useRuntimeConfig().public",
  },
};
