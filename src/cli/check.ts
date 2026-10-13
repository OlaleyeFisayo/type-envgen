import { existsSync, readFileSync } from "node:fs";
import { PREFIX, type TargetName } from "../core/constants/index.ts";
import { generateEnv } from "../core/generate-env/index.ts";
import { updateEnv } from "../core/generate-env/update-env.ts";
import { fail } from "./fail.ts";

/** Exits 1 if the output file is missing or out of date. Never writes anything. */
export function check(input: string, output: string, target: TargetName) {
  if (!existsSync(input)) throw new Error(`Input file not found: ${input}`);
  if (!existsSync(output)) fail(`${output} is out of date, run type-envgen to regenerate`);
  const source = generateEnv(readFileSync(input, "utf8"), target);
  const existing = readFileSync(output, "utf8");
  const normalize = (s: string) => s.replace(/\r\n/g, "\n");
  // The file may hold the user's own code, so compare against what an update would write, not a fresh file.
  if (normalize(updateEnv(existing, source, output)) !== normalize(existing)) {
    fail(`${output} is out of date, run type-envgen to regenerate`);
  }
  console.log(`${PREFIX} ✓ ${output} is up to date`);
}
