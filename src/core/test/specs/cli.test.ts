import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";
import { cli, cliPath, envPath, outDir, pkg } from "../utils/helpers.ts";

describe("cli", () => {
  it("generates the same output as generateEnv", () => {
    const out = join(outDir, "cli-env.ts");
    mkdirSync(outDir, { recursive: true });
    const run = cli(envPath, "-o", out);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^\[type-envgen\] ✓ Generated .* \(\d+ variables\)/);
    expect(run.stdout).not.toMatch(/zod/); // repo already lists zod: no install
    expect(readFileSync(out, "utf8")).toBe(generateEnv(readFileSync(envPath, "utf8")));
  });

  it("only prints an install hint with --skip-install", () => {
    const dir = join(outDir, "no-zod");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), "{}");
    const run = spawnSync(process.execPath, [cliPath, envPath, "-o", "env.ts", "--skip-install"], {
      cwd: dir,
      encoding: "utf8",
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/\[type-envgen\] zod is not in your dependencies\. Install it: npm install zod@\^4/);
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe("{}");
  });

  it("prints help listing every tag", () => {
    const help = cli("--help");
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/^\[type-envgen\]/);
    expect(help.stdout).toMatch(/Usage:/);
    expect(help.stdout).toMatch(/--check/);
    expect(help.stdout).toMatch(/@default/);
    expect(help.stdout).toMatch(/@optional/);
    expect(help.stdout).toMatch(/date, datetime, ipv4, ipv6/);
  });

  it("prints the version", () => {
    expect(cli("--version").stdout.trim()).toBe(`[type-envgen] ${pkg.version}`);
  });

  it("fails on a missing input file", () => {
    const run = cli("does-not-exist.env");
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^\[type-envgen\] Input file not found: does-not-exist\.env/);
  });

  it("fails on an unknown flag", () => {
    const run = cli("--nope");
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^\[type-envgen\] .*\nRun type-envgen --help for usage\./);
  });

  describe("--check", () => {
    it("exits 0 when output is up to date", () => {
      const out = join(outDir, "check-valid.ts");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(out, generateEnv(readFileSync(envPath, "utf8")));

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toMatch(new RegExp(`\\[type-envgen\\] ✓ ${out} is up to date`));
    });

    it("ignores CRLF vs LF differences", () => {
      const out = join(outDir, "check-crlf.ts");
      mkdirSync(outDir, { recursive: true });
      const crlfSource = generateEnv(readFileSync(envPath, "utf8")).replace(/\n/g, "\r\n");
      writeFileSync(out, crlfSource);

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toMatch(new RegExp(`\\[type-envgen\\] ✓ ${out} is up to date`));
    });

    it("exits 1 when output is out of date and does not modify the file", () => {
      const out = join(outDir, "check-outdated.ts");
      mkdirSync(outDir, { recursive: true });
      const outdatedContent = "// outdated content";
      writeFileSync(out, outdatedContent);

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(new RegExp(`\\[type-envgen\\] ${out} is out of date, run type-envgen to regenerate`));
      expect(readFileSync(out, "utf8")).toBe(outdatedContent);
    });

    it("exits 1 when output file does not exist", () => {
      const missing = join(outDir, "missing-check.ts");
      const run = cli(envPath, "-o", missing, "--check");
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(
        new RegExp(`\\[type-envgen\\] ${missing} is out of date, run type-envgen to regenerate`),
      );
    });
  });
});
