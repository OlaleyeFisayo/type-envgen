import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { PREFIX, TARGETS, type TargetName } from "../core/constants/index.ts";
import { addScript, initScripts } from "./scripts.ts";

const CANCELLED = `${PREFIX} Cancelled, nothing written.`;

/** Interactive setup: pick a target, then optionally add npm scripts that regenerate the file. */
export async function init(generate: (input: string, output: string, target: TargetName) => void) {
  p.intro(PREFIX);

  const target = await p.select({
    message: "Where will the generated env file run?",
    options: (Object.keys(TARGETS) as TargetName[]).map((value) => ({
      value,
      label: value,
      hint: TARGETS[value].hint,
    })),
  });
  if (p.isCancel(target)) return p.cancel(CANCELLED);

  const input = await p.text({ message: ".env file to read", initialValue: ".env" });
  if (p.isCancel(input)) return p.cancel(CANCELLED);
  const output = await p.text({ message: "File to generate", initialValue: "env.ts" });
  if (p.isCancel(output)) return p.cancel(CANCELLED);

  const command = `type-envgen ${input} -o ${output} --target ${target}`;
  const hasPkg = existsSync("package.json");
  if (hasPkg) {
    const scripts = initScripts(command);
    const list = scripts.map(([name, cmd]) => `  "${name}": "${cmd}"`).join("\n");
    const add = await p.confirm({ message: `Add these scripts to package.json?\n${list}` });
    if (p.isCancel(add)) return p.cancel(CANCELLED);
    if (add) {
      const original = readFileSync("package.json", "utf8");
      let json = original;
      const skipped: string[] = [];
      for (const [name, cmd] of scripts) {
        const next = addScript(json, name, cmd);
        if (next) json = next;
        else skipped.push(`"${name}"`);
      }
      if (json !== original) writeFileSync("package.json", json);
      if (skipped.length) p.log.warn(`${PREFIX} package.json already has ${skipped.join(", ")}, left unchanged.`);
    }
  } else p.log.info(`${PREFIX} No package.json here. Run it manually: ${command}`);

  try {
    generate(input, output, target);
  } catch (err) {
    return p.cancel(`${PREFIX} ${(err as Error).message}`);
  }
  p.outro(
    hasPkg
      ? `${PREFIX} Done. Regenerate with: npm run env:generate (env:watch while developing, env:check in CI)`
      : `${PREFIX} Done.`,
  );
}
