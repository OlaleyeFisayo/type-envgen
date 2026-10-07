# type-envgen

[![CI](https://github.com/OlaleyeFisayo/type-envgen/actions/workflows/ci.yml/badge.svg)](https://github.com/OlaleyeFisayo/type-envgen/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/type-envgen)](https://www.npmjs.com/package/type-envgen)
[![license](https://img.shields.io/github/license/OlaleyeFisayo/type-envgen)](./LICENSE)
[![node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlaleyeFisayo%2Ftype-envgen%2Fmain%2Fpackage.json&query=%24.engines.node&label=node)](https://nodejs.org)

Generate a typesafe, [zod](https://zod.dev)-validated env module from your `.env` file — with one command.

```sh
npx type-envgen -o src/env.ts
```

## Why

`process.env.PORT` is `string | undefined`. Every time. You end up sprinkling `Number(...)`, `=== "true"` and `!` across your codebase, and a missing variable only shows up as a crash deep inside your app.

`type-envgen` reads your `.env`, works out the type of every variable, and writes a module that validates `process.env` with zod **once, at startup** and exports a fully typed `env` object.

## Features

- **Zero config** — types are inferred from your values (numbers, booleans, URLs, emails, UUIDs, JSON, …)
- **Annotations** — override or refine types with `# @type`, `# @min`, `# @max` and `# @optional` comments
- **Typed JSON** — JSON values get a real schema, not `any`
- **Fail fast** — invalid or missing variables throw a clear zod error when your app starts
- **Safe on real `.env` files** — values are only used to infer types; secrets are never written to the output
- **Tiny** — the generated file only depends on `zod`

## Requirements

- Node.js **20.12** or newer
- **zod v4**: installed into your project automatically (see below)

## Installation

```sh
npm install --save-dev type-envgen
```

That's it. The generated file imports zod at runtime, so it has to be a regular dependency of your app. The first time you run `type-envgen`, it checks your `package.json` and, if zod is missing, adds `zod@^4` with your package manager (npm, pnpm, yarn or bun, detected from your lockfile):

```
[type-envgen] zod not found in package.json, installing it with npm...
[type-envgen] ✓ Installed zod
```

Prefer to manage it yourself? Pass `--skip-install` and the CLI only prints the install command.

Or run it once without installing:

```sh
npx type-envgen
```

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
# [type-envgen] ✓ Generated src/env.ts from .env (6 variables)
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

## CLI

```
type-envgen [input] [options]
```

| Argument / option     | Description              | Default  |
| --------------------- | ------------------------ | -------- |
| `input`               | `.env` file to read      | `.env`   |
| `-o, --output <path>` | File to write            | `env.ts` |
| `--skip-install`      | Don't add zod to your project if it's missing |  |
| `-h, --help`          | Show help                |          |
| `-v, --version`       | Show version             |          |

```sh
type-envgen                              # .env -> env.ts
type-envgen .env.example -o src/env.ts   # custom input and output
type-envgen --help                       # everything the CLI can do
```

- Missing output folders are created; an existing output file is overwritten.
- Every message is prefixed with `[type-envgen]`.
- Exit code `0` on success, `1` on any error (missing input, unknown flag, invalid annotation, failed zod install).

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

- On **numbers**: bounds on the value → `.min(1).max(65535)`
- On **strings, URLs, emails, UUIDs**: bounds on the length → `z.string().min(1)`
- Work with inferred types too — no `@type` needed.

```sh
# @min 32
JWT_SECRET=please-change-me-to-something-long-enough
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
- Mistakes fail loudly instead of being silently ignored. These all stop generation with an error naming the key:
  - unknown tag (`@mni`) or type (`@type nmber`)
  - empty `enum()`
  - non-numeric `@min` / `@max`, or `@min` greater than `@max`
  - `@min` / `@max` on a `boolean`, `enum` or `json`

## Loading env at runtime

The generated file reads `process.env`, so your `.env` still has to be loaded before it's imported:

```sh
node --env-file=.env dist/index.js     # Node 20.6+
```

```ts
import "dotenv/config";                // or with dotenv
import { env } from "./env";
```

Frameworks that load `.env` for you (Next.js, Remix, NestJS, …) work out of the box on the server.

If a variable is missing or invalid, `envSchema.parse` throws a `ZodError` listing every problem — at startup, not halfway through a request.

> `type-envgen` targets server-side / Node code. Client-side env systems like Vite's `import.meta.env` aren't supported.

## Recommended workflow

Add a script:

```json
{
  "scripts": {
    "env:gen": "type-envgen .env.example -o src/env.ts"
  }
}
```

- Generate from **`.env.example`** so teammates and CI get the same types without real secrets.
- **Commit the generated file** and regenerate it whenever you add or change a variable.

## Contributing

Contributions are welcome! Bug reports, ideas and pull requests all help.

- Read the [contributing guide](./CONTRIBUTING.md) for setup, git hooks, commit message format and PR rules.
- Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Found a security issue? See [SECURITY.md](./SECURITY.md). Please don't open a public issue.
- Maintainers: see [docs/releasing.md](./docs/releasing.md) for how releases work.

## License

[MIT](./LICENSE) © OlaleyeFisayo
