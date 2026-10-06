#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { generateEnv } from "./core/generate-env/index.ts";

const PREFIX = "[type-envgen]";

const HELP = `${PREFIX} Generate a typesafe, zod-validated env module from a .env file.

Usage:
  type-envgen [input] [options]

Arguments:
  input                .env file to read (default: .env)

Options:
  -o, --output <path>  File to write (default: env.ts)
  -h, --help           Show this help
  -v, --version        Show version

.env tags (comment lines directly above a key):
  # @type <type>       string, number, int, boolean, url, email, uuid, json, enum(a, b, c)
  # @min <n>           Minimum value (numbers) or length (strings)
  # @max <n>           Maximum value (numbers) or length (strings)
  # @optional          Key may be missing
  Untagged keys are inferred from their value and required.

Examples:
  type-envgen
  type-envgen .env.example -o src/env.ts

The generated file imports zod; install it in your project (npm i zod).`;

function fail(message: string): never {
  console.error(`${PREFIX} ${message}`);
  process.exit(1);
}

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o", default: "env.ts" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
} catch (err) {
  fail(`${(err as Error).message}\nRun type-envgen --help for usage.`);
}

const { values, positionals } = args;

if (values.help) {
  console.log(HELP);
} else if (values.version) {
  console.log(`${PREFIX} ${pkg.version}`);
} else {
  const input = positionals[0] ?? ".env";
  const output = values.output;
  if (!existsSync(input)) fail(`Input file not found: ${input}`);

  try {
    const source = generateEnv(readFileSync(input, "utf8"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, source);
    const count = source.match(/^ {2}\S+: /gm)?.length ?? 0;
    console.log(`${PREFIX} ✓ Generated ${output} from ${input} (${count} variables)`);
  } catch (err) {
    fail((err as Error).message);
  }
}
