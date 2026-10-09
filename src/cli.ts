#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { TARGETS, type TargetName } from "./core/generate-env/constants.ts";
import { generateEnv } from "./core/generate-env/index.ts";
import { init } from "./init.ts";

const PREFIX = "[type-envgen]";

const HELP = `${PREFIX} Generate a typesafe, zod-validated env module from a .env file.

Usage:
  type-envgen [input] [options]
  type-envgen init     Interactive setup: pick a target and add an npm script

Arguments:
  input                .env file to read (default: .env)

Options:
  -o, --output <path>  File to write (default: env.ts)
      --target <name>  Where the module runs (default: node)
      --skip-install   Don't add zod to your project if it's missing
  -h, --help           Show this help
  -v, --version        Show version

Targets:
${Object.entries(TARGETS)
  .map(([name, { hint }]) => `  ${name.padEnd(10)} ${hint}`)
  .join("\n")}

.env tags (comment lines directly above a key):
  # @type <type>       string, number, int, boolean, url, email, uuid, date, datetime, ipv4, ipv6, json, enum(a, b, c)
  # @default <value>   Fallback default value (.default(...), key is never undefined)
  # @min <n>           Minimum value (numbers) or length (strings)
  # @max <n>           Maximum value (numbers) or length (strings)
  # @pattern <regex>   Regex pattern constraint (.regex(...), string schemas only)
  # @optional          Key may be missing
  Untagged keys are inferred from their value and required.

Examples:
  type-envgen
  type-envgen .env.example -o src/env.ts

The generated file imports zod. It's added to your project's dependencies
automatically if missing (use --skip-install to opt out).`;

function fail(message: string): never {
  console.error(`${PREFIX} ${message}`);
  process.exit(1);
}

// The generated file imports zod at runtime, so it must be a real dependency of the
// user's project — type-envgen's own copy is skipped by --omit=dev and hidden by pnpm.
function ensureZod(skipInstall: boolean) {
  const pkgPath = "package.json";
  if (existsSync(pkgPath)) {
    const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync(pkgPath, "utf8"));
    if ("zod" in dependencies || "zod" in devDependencies) return;
  }

  const pm = existsSync("pnpm-lock.yaml")
    ? "pnpm add"
    : existsSync("yarn.lock")
      ? "yarn add"
      : existsSync("bun.lock") || existsSync("bun.lockb")
        ? "bun add"
        : "npm install";
  const command = `${pm} zod@^4`;

  if (skipInstall || !existsSync(pkgPath)) {
    console.log(`${PREFIX} zod is not in your dependencies. Install it: ${command}`);
    return;
  }

  console.log(`${PREFIX} zod not found in package.json, installing it with ${pm.split(" ")[0]}...`);
  // ponytail: fixed command string, shell needed on Windows where npm is npm.cmd
  const { status } = spawnSync(command, { stdio: "inherit", shell: true });
  if (status !== 0) fail(`Could not install zod. Run: ${command}`);
  console.log(`${PREFIX} ✓ Installed zod`);
}

function readArgs() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        output: { type: "string", short: "o", default: "env.ts" },
        target: { type: "string", default: "node" },
        "skip-install": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (err) {
    fail(`${(err as Error).message}\nRun type-envgen --help for usage.`);
  }
}

// Client bundlers only expose prefixed keys; anything else is undefined in the browser.
function warnUnprefixed(envSource: string, target: TargetName) {
  const { prefix } = TARGETS[target];
  for (const key of Object.keys(parseEnv(envSource))) {
    if (prefix && !key.startsWith(prefix)) {
      console.error(
        `${PREFIX} warning: ${key} doesn't start with ${prefix}, so it is undefined in the browser. Never put secrets in a client bundle.`,
      );
    }
  }
}

function generate(input: string, output: string, target: TargetName) {
  if (!existsSync(input)) throw new Error(`Input file not found: ${input}`);
  const envSource = readFileSync(input, "utf8");
  const source = generateEnv(envSource, target);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, source);
  const count = Object.keys(parseEnv(envSource)).length;
  console.log(`${PREFIX} ✓ Generated ${output} from ${input} (${count} variables)`);
  warnUnprefixed(envSource, target);
}

const { values, positionals } = readArgs();
const target = values.target as string;
if (!(target in TARGETS)) fail(`Unknown target "${target}". Choose one of: ${Object.keys(TARGETS).join(", ")}`);

if (values.help) {
  console.log(HELP);
} else if (values.version) {
  console.log(`${PREFIX} ${pkg.version}`);
} else if (positionals[0] === "init") {
  await init((input, output, t) => {
    generate(input, output, t);
    ensureZod(false);
  });
} else {
  try {
    generate(positionals[0] ?? ".env", values.output, target as TargetName);
  } catch (err) {
    fail((err as Error).message);
  }

  ensureZod(values["skip-install"] ?? false);
}
