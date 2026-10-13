import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseEnv } from "node:util";
import { PREFIX, TARGETS, type TargetName } from "../core/constants/index.ts";
import { generateEnv } from "../core/generate-env/index.ts";
import { updateEnv } from "../core/generate-env/update-env.ts";

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

/** Writes the env module, or updates it in place if it already exists. Throws on bad input. */
export function generate(input: string, output: string, target: TargetName) {
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
