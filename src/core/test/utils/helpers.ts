import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { generateEnv } from "../../generate-env/index.ts";

export const dir = import.meta.dirname;
export const envPath = join(dir, "..", ".env");
export const outDir = join(dir, "..", "output");
export const cliPath = join(dir, "../../../../dist/cli.js");
export const pkg = JSON.parse(readFileSync(join(dir, "../../../../package.json"), "utf8"));

// Generates from the shared fixture and imports the result. Each test file passes its own
// name so parallel files never write the same output.
export async function loadGenerated(name: string) {
  const output = generateEnv(readFileSync(envPath, "utf8"));
  const outPath = join(outDir, `${name}.ts`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, output);
  process.loadEnvFile(envPath);
  const { env, envSchema } = await import(pathToFileURL(outPath).href);
  return { output, env, envSchema };
}

export const cli = (...args: string[]) => spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
