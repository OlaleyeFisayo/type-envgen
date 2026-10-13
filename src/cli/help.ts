import { PREFIX, TARGETS } from "../core/constants/index.ts";

export const HELP = `${PREFIX} Generate a typesafe, zod-validated env module from a .env file.

Usage:
  type-envgen [input] [options]
  type-envgen init     Interactive setup: pick a target and add an npm script

Arguments:
  input                .env file to read (default: .env)

Options:
  -o, --output <path>  File to write (default: env.ts)
      --target <name>  Where the module runs (default: node)
      --check          Exit 1 if the output file is out of date (writes nothing)
  -w, --watch          Watch input file and regenerate on changes
      --skip-install   Don't add zod/type-envgen to your dependencies if missing
  -h, --help           Show this help
  -v, --version        Show version

Targets:
${Object.entries(TARGETS)
  .map(([name, { hint }]) => `  ${name.padEnd(10)} ${hint}`)
  .join("\n")}

.env tags (comment lines directly above a key):
  # @type <type>       string, number, int, boolean, url, email, uuid, uuid(v1-v8), guid, date, datetime, ipv4, ipv6, json, enum(a, b, c)
  # @default <value>   Fallback default value (.default(...), key is never undefined)
  # @min <n>           Minimum value (numbers) or length (strings)
  # @max <n>           Maximum value (numbers) or length (strings)
  # @pattern <regex>   Regex pattern constraint (.regex(...), string schemas only)
  # @minlength <n>     Minimum length for string-like schemas
  # @maxlength <n>     Maximum length for string-like schemas
  # @optional          Key may be missing
  Untagged keys are inferred from their value and required.

Examples:
  type-envgen
  type-envgen .env.example -o src/env.ts
  type-envgen --watch

The generated file imports zod and type-envgen. They're added to your project's
dependencies automatically if missing (use --skip-install to opt out).`;
