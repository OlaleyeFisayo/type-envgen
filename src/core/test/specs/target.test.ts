import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addScript } from "../../../init.ts";
import { generateEnv } from "../../generate-env/index.ts";
import { cli } from "../utils/helpers.ts";

const src = "PUBLIC_API_URL=https://a.com\nNUXT_PUBLIC_API_URL=https://b.com\nPORT=3000";

describe("targets", () => {
  it("node is the default and reads process.env", () => {
    expect(generateEnv(src, "node")).toBe(generateEnv(src));
    expect(generateEnv(src)).toContain("envSchema.parse(process.env);");
  });

  it("vite and astro read import.meta.env", () => {
    for (const t of ["vite", "astro"] as const)
      expect(generateEnv(src, t)).toContain("envSchema.parse(import.meta.env);");
  });

  it("sveltekit reads $env/dynamic/public", () => {
    const out = generateEnv(src, "sveltekit");
    expect(out).toContain(`import { env as publicEnv } from "$env/dynamic/public";`);
    expect(out).toContain("envSchema.parse(publicEnv);");
  });

  it("nextjs lists each key as a literal process.env reference", () => {
    const out = generateEnv(src, "nextjs");
    expect(out).toContain("envSchema.parse({\n");
    expect(out).toContain("  PUBLIC_API_URL: process.env.PUBLIC_API_URL,");
    expect(out).toContain("  PORT: process.env.PORT,");
    expect(out).toContain("\n});\nexport type");
  });

  it("nuxt camelCases keys and reads runtime config", () => {
    const out = generateEnv(src, "nuxt");
    expect(out).toContain("  apiUrl: z.url(),");
    expect(out).toContain("envSchema.parse(useRuntimeConfig().public);");
  });

  it("cli rejects an unknown target", () => {
    const run = cli("--target", "bogus");
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Unknown target "bogus"/);
  });

  it("cli warns about keys without the client prefix", () => {
    const dir = mkdtempSync(join(tmpdir(), "envgen-"));
    const env = join(dir, "target.env");
    writeFileSync(env, "VITE_A=1\nSECRET=x");
    const run = cli(env, "-o", join(dir, "target-vite.ts"), "--target", "vite", "--skip-install");
    expect(run.status, run.stderr).toBe(0);
    expect(run.stderr).toMatch(/SECRET doesn't start with VITE_/);
    expect(run.stderr).not.toMatch(/VITE_A/);
  });
});

describe("addScript", () => {
  it("adds a script and keeps the indent", () => {
    const out = addScript('{\n    "name": "x"\n}\n', "env:generate", "cmd");
    expect(JSON.parse(out as string).scripts).toEqual({ "env:generate": "cmd" });
    expect(out).toContain('\n    "name"');
  });

  it("never overwrites an existing script", () => {
    expect(addScript('{"scripts":{"env:generate":"mine"}}', "env:generate", "cmd")).toBeNull();
  });
});
