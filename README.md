# type-envgen

[![CI](https://github.com/OlaleyeFisayo/type-envgen/actions/workflows/ci.yml/badge.svg)](https://github.com/OlaleyeFisayo/type-envgen/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/type-envgen)](https://www.npmjs.com/package/type-envgen)
[![license](https://img.shields.io/github/license/OlaleyeFisayo/type-envgen)](./LICENSE)
[![node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlaleyeFisayo%2Ftype-envgen%2Fmain%2Fpackage.json&query=%24.engines.node&label=node)](https://nodejs.org)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/OlaleyeFisayo/type-envgen/badge)](https://scorecard.dev/viewer/?uri=github.com/OlaleyeFisayo/type-envgen)

**Generate a typesafe, [zod](https://zod.dev)-validated environment module from your `.env` file.**

`type-envgen` reads your `.env`, infers the type of every variable, and writes a TypeScript module that validates your environment once at startup and exports a fully typed `env` object. It works on the server (Node) and in the browser (Vite, Next.js, Astro, SvelteKit, Nuxt).

```sh
npx type-envgen init
```

## Why

`process.env.PORT` is `string | undefined`, every time. Teams end up scattering `Number(...)`, `=== "true"` and non-null assertions across the codebase, and a missing variable only surfaces as a crash deep inside the app.

`type-envgen` moves that work to one generated file. Invalid or missing variables fail immediately, with a clear error listing every problem, and everything downstream gets real types.

## Features

- **Zero config**: types are inferred from your values (numbers, booleans, URLs, emails, UUIDs, dates, IPs, JSON, and more).
- **Annotations**: refine types with `@type`, `@default`, `@min`, `@max`, `@minlength`, `@maxlength` and `@optional` comments.
- **Multiple targets**: Node, Vite, Next.js, Astro, SvelteKit and Nuxt, each reading from the right source.
- **Guided setup**: `type-envgen init` explains each target and adds an npm script for you.
- **Typed JSON**: JSON values get a real schema, not `any`.
- **Fail fast**: bad or missing variables throw a zod error at startup.
- **Safe on real `.env` files**: values are only used to infer types and are never written to the output.
- **Tiny output**: the generated file depends only on `zod`.

## Requirements

- Node.js **20.12** or newer
- **zod v4**, added to your project automatically if missing (see below)

## Installation

```sh
npm install --save-dev type-envgen
```

The generated file imports zod at runtime, so zod must be a regular dependency of your app. On first run, `type-envgen` checks your `package.json` and, if zod is missing, installs `zod@^4` with your package manager (npm, pnpm, yarn or bun, detected from your lockfile):

```
zod not found in package.json, installing it with npm...
✓ Installed zod
```

Prefer to manage it yourself? Pass `--skip-install` and the CLI only prints the install command. You can also run it without installing: `npx type-envgen`.

## Quick start

**1. Write (or annotate) your `.env`:**

```sh
# @min 1
# @max 65535
PORT=3000

DATABASE_URL=postgres://user:pass@localhost:5432/app
DEBUG=false

# @type enum(debug, info, warn, error)
LOG_LEVEL=info

# @optional
SENTRY_DSN=https://abc@sentry.io/123

FEATURE_FLAGS={"beta":true,"maxUsers":100}
```

**2. Generate the module:**

```sh
npx type-envgen -o src/env.ts
# ✓ Generated src/env.ts from .env (6 variables)
```

**3. Get this `src/env.ts`:**

```ts
import { z } from "zod";

const json = <T extends z.ZodType>(schema: T) => /* JSON.parse + validate */;

export const envSchema = z.object({
  DATABASE_URL: z.url(),
  DEBUG: z.stringbool(),
  FEATURE_FLAGS: json(z.object({ beta: z.boolean(), maxUsers: z.number() })),
  LOG_LEVEL: z.enum(["debug","info","warn","error"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  SENTRY_DSN: z.url().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

**4. Use it:**

```ts
import { env } from "./env";

env.PORT;                   // number
env.DEBUG;                  // boolean
env.LOG_LEVEL;              // "debug" | "info" | "warn" | "error"
env.SENTRY_DSN;             // string | undefined
env.FEATURE_FLAGS.maxUsers; // number
```

## Targets

A **target** decides where the generated module reads its values from. Browsers have no `process.env`, and each framework exposes client variables differently, so pick the one that matches where your code runs. The default is `node`.

| Target      | Reads from                    | Client-exposed keys | Generated call                                 |
| ----------- | ----------------------------- | ------------------- | ---------------------------------------------- |
| `node`      | `process.env`                 | n/a (server only)   | `envSchema.parse(process.env)`                 |
| `vite`      | `import.meta.env`             | `VITE_*`            | `envSchema.parse(import.meta.env)`             |
| `nextjs`    | `process.env.<KEY>`           | `NEXT_PUBLIC_*`     | `envSchema.parse({ KEY: process.env.KEY, … })` |
| `astro`     | `import.meta.env`             | `PUBLIC_*`          | `envSchema.parse(import.meta.env)`             |
| `sveltekit` | `$env/dynamic/public`         | `PUBLIC_*`          | `envSchema.parse(publicEnv)`                   |
| `nuxt`      | `useRuntimeConfig().public`   | `NUXT_PUBLIC_*`     | `envSchema.parse(useRuntimeConfig().public)`   |

```sh
type-envgen .env.example -o src/env.ts --target vite
```

Target notes:

- **Next.js** only inlines literal `process.env.KEY` references in client bundles, so the generated file lists every key explicitly instead of passing `process.env`.
- **Nuxt** exposes public values as camelCase runtime config, so `NUXT_PUBLIC_API_URL` becomes the schema key `apiUrl`.
- **Vite and Astro** need the framework's client types for `import.meta.env` to typecheck (`vite/client`, or Astro's generated types).

### Client targets and secrets

Bundlers only expose prefixed variables, and anything in a client bundle is readable by every visitor. For client targets, `type-envgen` prints a warning for each key that lacks the target's prefix, because it would be `undefined` in the browser. Never put secrets in a variable that ends up in a client bundle.

```
warning: DATABASE_URL doesn't start with VITE_, so it is undefined in the browser. Never put secrets in a client bundle.
```

### Interactive setup

```sh
npx type-envgen init
```

The wizard explains each target, asks which `.env` file to read and where to write the result, then offers to add an npm script to your `package.json` and generates the file once:

```json
{
  "scripts": {
    "env:generate": "type-envgen .env -o src/env.ts --target vite"
  }
}
```

An existing `env:generate` script is never overwritten, and cancelling at any prompt writes nothing.

## CLI reference

```
type-envgen [input] [options]
type-envgen init
```

| Argument / option     | Description                                    | Default  |
| --------------------- | ---------------------------------------------- | -------- |
| `input`               | `.env` file to read                            | `.env`   |
| `-o, --output <path>` | File to write                                  | `env.ts` |
| `--target <name>`     | `node`, `vite`, `nextjs`, `astro`, `sveltekit`, `nuxt` | `node` |
| `--skip-install`      | Don't add zod to your project if it's missing  |          |
| `-h, --help`          | Show help                                      |          |
| `-v, --version`       | Show version                                   |          |

```sh
type-envgen                              # .env -> env.ts
type-envgen .env.example -o src/env.ts   # custom input and output
type-envgen --target nextjs              # client-safe output for Next.js
type-envgen --help                       # everything the CLI can do
```

- Missing output folders are created; an existing output file is overwritten.
- Exit code `0` on success, `1` on any error (missing input, unknown flag or target, invalid annotation, failed zod install).

## Type inference

Untagged variables are inferred from their value. Rules are checked top to bottom; the first match wins.

| Example value                     | Schema                                           | TypeScript type |
| --------------------------------- | ------------------------------------------------ | --------------- |
| `NODE_ENV=development`            | `z.enum(["development","production","test"])`    | union           |
| `BASE_URL=http://${HOST}`         | `z.string()` (references aren't resolved)        | `string`        |
| `true` / `false`                  | `z.stringbool()`                                 | `boolean`       |
| `3000`, `-42`, `0`                | `z.coerce.number().int()`                        | `number`        |
| `3.14`                            | `z.coerce.number()`                              | `number`        |
| `https://…`, `postgres://…`       | `z.url()`                                        | `string`        |
| `550e8400-e29b-41d4-a716-…`       | `z.uuid()`                                       | `string`        |
| `admin@example.com`               | `z.email()`                                      | `string`        |
| `2026-01-31`                      | `z.iso.date()`                                   | `string`        |
| `2026-01-31T10:00:00Z`            | `z.iso.datetime()`                               | `string`        |
| `192.168.0.1`                     | `z.ipv4()`                                       | `string`        |
| `::1`                             | `z.ipv6()`                                       | `string`        |
| `{"a":1}`, `["a","b"]`            | `json(<schema built from the value>)`            | typed object/array |
| anything else (including empty)   | `z.string()`                                     | `string`        |

Good to know:

- `1` and `0` are inferred as **numbers**, not booleans. Use `# @type boolean` if you mean a flag.
- A comma-separated value like `a,b,c` stays a `string`.
- Every variable is **required** unless marked `# @optional`.

## Annotations

Put tags in comment lines **directly above** a key. Tags can be combined in any order.

```sh
# @type int
# @min 1
# @max 65535
PORT=3000
```

### `@type <type>`

Overrides inference.

| Type            | Schema                           |
| --------------- | -------------------------------- |
| `string`        | `z.string()`                     |
| `number`        | `z.coerce.number()`              |
| `int`           | `z.coerce.number().int()`        |
| `boolean`       | `z.stringbool()`                 |
| `url`           | `z.url()`                        |
| `email`         | `z.email()`                      |
| `uuid`          | `z.uuid()`                       |
| `date`          | `z.iso.date()`                   |
| `datetime`      | `z.iso.datetime()`               |
| `ipv4`          | `z.ipv4()`                       |
| `ipv6`          | `z.ipv6()`                       |
| `json`          | `json(<schema built from the value>)` |
| `enum(a, b, c)` | `z.enum(["a","b","c"])`          |

```sh
# @type boolean
VERBOSE=1

# @type enum(development, staging, production)
APP_ENV=staging
```

Type names are case-insensitive; enum values keep their case.

### `@min <n>` / `@max <n>`

- On **numbers**: bounds on the value, e.g. `.min(1).max(65535)`.
- On **strings, URLs, emails, UUIDs, dates, IPs**: bounds on the length, e.g. `z.string().min(1)`.
- Work with inferred types too, no `@type` needed.

```sh
# @min 32
JWT_SECRET=please-change-me-to-something-long-enough
```

### `@minlength <n>` / `@maxlength <n>`

Bounds on the length of string-like schemas (`string`, `url`, `email`, `uuid`, `date`, `datetime`, `ipv4`, `ipv6`). Emits `.min(n)` / `.max(n)` on the Zod schema. `<n>` must be a non-negative integer.

```sh
# @minlength 8
# @maxlength 64
JWT_SECRET=please-change-me-to-something-long-enough
# -> JWT_SECRET: z.string().min(8).max(64)
```

`@min` and `@max` on strings remain supported as aliases for backward compatibility.

### `@default <value>`

Provides a fallback emitted as zod's `.default(...)`, so the variable is never `undefined` when missing from the environment. The value is validated against the inferred or annotated type at generation time (for example, `@default abc` on an integer is an error).

```sh
# @default 3000
PORT=3000
# -> PORT: z.coerce.number().int().default(3000)

# @default info
LOG_LEVEL=info
# -> LOG_LEVEL: z.string().default("info")
```

### `@optional`

The variable may be missing; its type becomes `T | undefined`.

```sh
# @optional
SENTRY_DSN=https://abc@sentry.io/123
```

### Rules

- A **blank line** between the tags and the key cancels them.
- Regular comments (without `@`) are ignored and can sit between tags.
- Mistakes fail loudly instead of being silently ignored. Each of these stops generation with an error naming the key:
  - unknown tag (`@mni`) or type (`@type nmber`)
  - combining `@default` and `@optional` on the same key
  - invalid `@default` value (non-integer on an int, out of bounds with `@min`/`@max` or `@minlength`/`@maxlength`, invalid URL/email/UUID, invalid enum option, or invalid JSON)
  - empty `enum()`
  - non-numeric `@min` / `@max`, non-integer or negative `@minlength` / `@maxlength`, or min greater than max
  - `@min` / `@max` on a `boolean`, `enum` or `json`, or `@minlength` / `@maxlength` on non-string schemas

## Loading env at runtime

For the `node` target, your `.env` must be loaded before the generated file is imported:

```sh
node --env-file=.env dist/index.js     # Node 20.6+
```

```ts
import "dotenv/config";                // or with dotenv
import { env } from "./env";
```

Frameworks that load `.env` for you (Next.js, Remix, NestJS, and others) work out of the box on the server. For client targets, the framework or bundler injects the values at build time.

If a variable is missing or invalid, `envSchema.parse` throws a `ZodError` listing every problem, at startup rather than halfway through a request.

## Recommended workflow

- Run `npx type-envgen init` once to pick a target and add the `env:generate` script.
- Generate from **`.env.example`** so teammates and CI get the same types without real secrets.
- **Commit the generated file** and re-run `npm run env:generate` whenever you add or change a variable.

## Contributing

Contributions are welcome. Bug reports, ideas and pull requests all help.

- Questions or ideas? Start a thread in [Discussions](https://github.com/OlaleyeFisayo/type-envgen/discussions).
- Want to help? Look for [`good first issue`](https://github.com/OlaleyeFisayo/type-envgen/labels/good%20first%20issue) and [`help wanted`](https://github.com/OlaleyeFisayo/type-envgen/labels/help%20wanted) issues.
- Read the [contributing guide](./CONTRIBUTING.md) for setup, git hooks, commit message format and PR rules.
- Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Found a security issue? See [SECURITY.md](./SECURITY.md) and please don't open a public issue.
- See the [changelog](./CHANGELOG.md) for what changed in each version.
- Maintainers: see [docs/releasing.md](./docs/releasing.md) for how releases work.

## License

[MIT](./LICENSE) © OlaleyeFisayo
