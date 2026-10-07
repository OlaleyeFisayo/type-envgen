import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { generateEnv } from "../generate-env/index.ts";

const dir = import.meta.dirname;
const envPath = join(dir, ".env");
const outPath = join(dir, "output", "env.ts");

const output = generateEnv(readFileSync(envPath, "utf8"));
mkdirSync(join(dir, "output"), { recursive: true });
writeFileSync(outPath, output);

// Round trip: the generated schema must accept the sample it was generated from.
process.loadEnvFile(envPath);
const { env, envSchema } = await import(pathToFileURL(outPath).href);

assert.equal(env.PORT, 3000);
assert.equal(env.DEBUG, true);
assert.equal(env.FEATURE_FLAG, false);
assert.equal(env.FLOAT, 3.14);
assert.deepEqual(env.JSON_ARRAY, ["a", "b", "c"]);
assert.deepEqual(env.JSON_OBJECT, { key: "value", n: 1 });
assert.equal(typeof env.APP_NAME, "string");
assert.equal(env.DEFAULT_PORT, 8080);
assert.equal(env.DEFAULT_HOST, "localhost");
assert.match(output, /APP_ID: z\.uuid\(\)/);
assert.match(output, /API_URL: z\.url\(\)/);
assert.match(output, /ADMIN_EMAIL: z\.email\(\)/);

// @type annotations
assert.equal(env.VERBOSE, true); // overrides number inference
assert.match(output, /LOG_LEVEL: z\.enum\(\["debug","info","warn","error"\]\)/);
assert.throws(() => generateEnv("# @type nope\nX=1"), /Unknown @type "nope" for X/);
assert.match(generateEnv("# @type string\n\nX=1"), /X: z\.coerce\.number\(\)\.int\(\)/); // blank line cancels

// @optional / @required / @min / @max
assert.match(output, /PORT: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(65535\)/);
assert.match(output, /APP_NAME: z\.string\(\)\.min\(1\)/);
assert.match(output, /OPTIONAL_TOKEN: z\.string\(\)\.optional\(\)/);
assert.match(output, /DATABASE_URL: z\.url\(\),/);
assert.equal(envSchema.safeParse({ ...process.env, PORT: "0" }).success, false);
const { OPTIONAL_TOKEN, ...withoutToken } = process.env;
assert.equal(envSchema.safeParse(withoutToken).success, true);
assert.throws(() => generateEnv("# @mni 1\nX=1"), /Unknown tag @mni for X/);
assert.throws(() => generateEnv("# @min abc\nX=1"), /@min for X must be a number/);
assert.throws(() => generateEnv("# @min 5\n# @max 1\nX=1"), /greater than @max/);
assert.throws(() => generateEnv("# @type boolean\n# @min 1\nX=true"), /@min is not supported for X/);
assert.throws(() => generateEnv("# @required\nX=1"), /Unknown tag @required for X/);

// @default
assert.match(output, /DEFAULT_PORT: z\.coerce\.number\(\)\.int\(\)\.default\(8080\)/);
assert.match(output, /DEFAULT_HOST: z\.string\(\)\.default\("localhost"\)/);
const { DEFAULT_PORT, DEFAULT_HOST, ...withoutDefaults } = process.env;
const parsedDefaults = envSchema.parse(withoutDefaults);
assert.equal(parsedDefaults.DEFAULT_PORT, 8080);
assert.equal(parsedDefaults.DEFAULT_HOST, "localhost");

assert.throws(() => generateEnv("# @default\nX=1"), /@default for X requires a value/);
assert.throws(() => generateEnv("# @default 3000\n# @optional\nX=3000"), /Cannot combine @default and @optional for X/);
assert.throws(() => generateEnv("# @type int\n# @default abc\nX=1"), /@default for X must be an integer/);
assert.throws(() => generateEnv("# @type number\n# @default abc\nX=1.5"), /@default for X must be a number/);
assert.throws(() => generateEnv("# @type boolean\n# @default nope\nX=true"), /@default for X must be a boolean/);
assert.throws(
  () => generateEnv("# @type url\n# @default not-a-url\nX=https://api.com"),
  /@default for X must be a valid URL/,
);
assert.throws(
  () => generateEnv("# @type email\n# @default not-an-email\nX=a@b.com"),
  /@default for X must be a valid email/,
);
assert.throws(
  () => generateEnv("# @type uuid\n# @default not-a-uuid\nX=550e8400-e29b-41d4-a716-446655440000"),
  /@default for X must be a valid UUID/,
);
assert.throws(() => generateEnv("# @type enum(a, b)\n# @default c\nX=a"), /@default "c" for X is not in enum/);
assert.throws(() => generateEnv('# @default {bad json}\nX={"a":1}'), /@default for X must be valid JSON/);
assert.throws(() => generateEnv("# @min 10\n# @default 5\nX=10"), /less than @min/);
assert.throws(() => generateEnv("# @max 5\n# @default 10\nX=5"), /greater than @max/);
assert.throws(() => generateEnv("# @min 5\n# @default hi\nX=hello"), /less than @min/);
assert.throws(() => generateEnv("# @max 3\n# @default hello\nX=hi"), /greater than @max/);

// CLI (built dist/cli.js; test:gen runs tsup first)
const cliPath = join(dir, "../../../dist/cli.js");
const cli = (...args: string[]) => spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
const pkg = JSON.parse(readFileSync(join(dir, "../../../package.json"), "utf8"));

const cliOut = join(dir, "output", "cli-env.ts");
const run = cli(envPath, "-o", cliOut);
assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /^\[type-envgen\] ✓ Generated .* \(\d+ variables\)/);
assert.equal(readFileSync(cliOut, "utf8"), output);
assert.doesNotMatch(run.stdout, /zod/); // repo already lists zod: no install

// Project without zod + --skip-install: hint only, no install
const noZodDir = join(dir, "output", "no-zod");
mkdirSync(noZodDir, { recursive: true });
writeFileSync(join(noZodDir, "package.json"), "{}");
const noZod = spawnSync(process.execPath, [cliPath, envPath, "-o", "env.ts", "--skip-install"], {
  cwd: noZodDir,
  encoding: "utf8",
});
assert.equal(noZod.status, 0, noZod.stderr);
assert.match(noZod.stdout, /\[type-envgen\] zod is not in your dependencies\. Install it: npm install zod@\^4/);
assert.equal(readFileSync(join(noZodDir, "package.json"), "utf8"), "{}");

const help = cli("--help");
assert.equal(help.status, 0);
assert.match(help.stdout, /^\[type-envgen\]/);
assert.match(help.stdout, /Usage:/);
assert.match(help.stdout, /@default/);
assert.match(help.stdout, /@optional/);

assert.equal(cli("--version").stdout.trim(), `[type-envgen] ${pkg.version}`);

const missing = cli("does-not-exist.env");
assert.equal(missing.status, 1);
assert.match(missing.stderr, /^\[type-envgen\] Input file not found: does-not-exist\.env/);

const badFlag = cli("--nope");
assert.equal(badFlag.status, 1);
assert.match(badFlag.stderr, /^\[type-envgen\] .*\nRun type-envgen --help for usage\./);
