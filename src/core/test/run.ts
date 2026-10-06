import assert from "node:assert/strict";
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
assert.throws(() => generateEnv("# @optional\n# @required\nX=1"), /both @optional and @required/);
