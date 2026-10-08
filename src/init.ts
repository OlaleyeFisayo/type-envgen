import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { TARGETS, type TargetName } from "./core/generate-env/constants.ts";

const PREFIX = "[type-envgen]";
const SCRIPT = "env:generate";
const CANCELLED = `${PREFIX} Cancelled, nothing written.`;

/** Adds `scripts[name]` to a package.json string, keeping its indent. Returns null if it already exists. */
export function addScript(pkgJson: string, name: string, command: string): string | null {
  const pkg = JSON.parse(pkgJson);
  if (pkg.scripts?.[name]) return null;
  pkg.scripts = { ...pkg.scripts, [name]: command };
  const indent = pkgJson.match(/^[ \t]+(?=")/m)?.[0] ?? 2;
  return `${JSON.stringify(pkg, null, indent)}\n`;
}

/** Interactive setup: pick a target, then optionally add an npm script that regenerates the file. */
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
    const add = await p.confirm({ message: `Add "${SCRIPT}": "${command}" to package.json scripts?` });
    if (p.isCancel(add)) return p.cancel(CANCELLED);
    if (add) {
      const next = addScript(readFileSync("package.json", "utf8"), SCRIPT, command);
      if (next) writeFileSync("package.json", next);
      else p.log.warn(`${PREFIX} package.json already has a "${SCRIPT}" script, left unchanged.`);
    }
  } else p.log.info(`${PREFIX} No package.json here. Run it manually: ${command}`);

  try {
    generate(input, output, target);
  } catch (err) {
    return p.cancel(`${PREFIX} ${(err as Error).message}`);
  }
  p.outro(hasPkg ? `${PREFIX} Done. Regenerate any time with: npm run ${SCRIPT}` : `${PREFIX} Done.`);
}
