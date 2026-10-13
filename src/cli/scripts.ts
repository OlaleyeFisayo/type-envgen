import { INIT_SCRIPTS } from "../core/constants/index.ts";

/** Adds `scripts[name]` to a package.json string, keeping its indent. Returns null if it already exists. */
export function addScript(pkgJson: string, name: string, command: string): string | null {
  const pkg = JSON.parse(pkgJson);
  if (pkg.scripts?.[name]) return null;
  pkg.scripts = { ...pkg.scripts, [name]: command };
  const indent = pkgJson.match(/^[ \t]+(?=")/m)?.[0] ?? 2;
  return `${JSON.stringify(pkg, null, indent)}\n`;
}

/** The npm scripts `init` offers: generate, plus the same command with --check and --watch. */
export function initScripts(command: string): [string, string][] {
  return Object.entries(INIT_SCRIPTS).map(([name, flags]) => [name, `${command}${flags}`]);
}
