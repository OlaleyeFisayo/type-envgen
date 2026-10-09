#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { PREFIX, TARGETS, type TargetName, ZOD_SPEC } from "./core/constants/index.ts";
import { generateEnv } from "./core/generate-env/index.ts";
import { updateEnv } from "./core/generate-env/update-env.ts";
import { init } from "./init.ts";

const HELP = `${PREFIX} Generate a typesafe, zod-validated env module from a .env file.

Usage:
  type-envgen [input] [options]
  type-envgen init     Interactive setup: pick a target and add an npm script

Arguments:
  input                .env file to read (default: .env)

Options:
  -o, --output <path>  File to write (default: env.ts)
      --target <name>  Where the module runs (default: node)
      --skip-install   Don't add zod/type-envgen to your dependencies if missing
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
  # @minlength <n>     Minimum length for string-like schemas
  # @maxlength <n>     Maximum length for string-like schemas
  # @optional          Key may be missing
  Untagged keys are inferred from their value and required.

Examples:
  type-envgen
  type-envgen .env.example -o src/env.ts

The generated file imports zod and type-envgen. They're added to your project's
dependencies automatically if missing (use --skip-install to opt out).`;

function fail(message: string): never {
  console.error(`${PREFIX} ${message}`);
  process.exit(1);
}

// The generated file imports zod and type-envgen at runtime, so both must be real dependencies
// of the user's project — a devDependency is skipped by --omit=dev.
function ensureDeps(skipInstall: boolean) {
  const pkgPath = "package.json";
  const {
    name,
    dependencies = {},
    devDependencies = {},
  } = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")) : {};
  const missing = [
    ...("zod" in dependencies || "zod" in devDependencies ? [] : [ZOD_SPEC]),
    ...("type-envgen" in dependencies || name === "type-envgen" ? [] : [`type-envgen@^${pkg.version}`]),
  ];
  if (!missing.length) return;
  const names = missing.map((m) => m.slice(0, m.lastIndexOf("@"))).join(" and ");

  const pm = existsSync("pnpm-lock.yaml")
    ? "pnpm add"
    : existsSync("yarn.lock")
      ? "yarn add"
      : existsSync("bun.lock") || existsSync("bun.lockb")
        ? "bun add"
        : "npm install";
  const command = `${pm} ${missing.join(" ")}`;
  const verb = missing.length > 1 ? "are" : "is";

  if (skipInstall || !existsSync(pkgPath)) {
    console.log(`${PREFIX} ${names} ${verb} not in your dependencies. Install: ${command}`);
    return;
  }

  console.log(`${PREFIX} ${names} not found in package.json dependencies, installing with ${pm.split(" ")[0]}...`);
  // ponytail: fixed command string, shell needed on Windows where npm is npm.cmd
  const { status } = spawnSync(command, { stdio: "inherit", shell: true });
  if (status !== 0) fail(`Could not install ${names}. Run: ${command}`);
  console.log(`${PREFIX} ✓ Installed ${names}`);
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
  // An existing file keeps the user's own code; only the generated parts are refreshed.
  const existing = existsSync(output) ? readFileSync(output, "utf8") : undefined;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, existing === undefined ? source : updateEnv(existing, source, output));
  const count = Object.keys(parseEnv(envSource)).length;
  const verb = existing === undefined ? "Generated" : "Updated";
  console.log(`${PREFIX} ✓ ${verb} ${output} from ${input} (${count} variables)`);
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
    ensureDeps(false);
  });
} else {
  try {
    generate(positionals[0] ?? ".env", values.output, target as TargetName);
  } catch (err) {
    fail((err as Error).message);
  }

  ensureDeps(values["skip-install"] ?? false);
}
