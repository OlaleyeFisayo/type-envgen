import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import pkg from "../../package.json" with { type: "json" };
import { PREFIX, ZOD_SPEC } from "../core/constants/index.ts";
import { fail } from "./fail.ts";

// The generated file imports zod and type-envgen at runtime, so both must be real dependencies
// of the user's project — a devDependency is skipped by --omit=dev.
export function ensureDeps(skipInstall: boolean) {
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
