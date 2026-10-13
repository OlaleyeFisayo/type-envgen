import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
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

  it("updates an existing file in place, keeping the user's code", () => {
    const out = join(outDir, "cli-update.ts");
    mkdirSync(outDir, { recursive: true });
    expect(cli(envPath, "-o", out).stdout).toMatch(/✓ Generated/);
    const custom = 'export const isProd = env.NODE_ENV === "production";\n';
    writeFileSync(out, readFileSync(out, "utf8") + custom);
    const run = cli(envPath, "-o", out);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^\[type-envgen\] ✓ Updated .* \(\d+ variables\)/);
    expect(readFileSync(out, "utf8")).toBe(generateEnv(readFileSync(envPath, "utf8")) + custom);
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
    expect(run.stdout).toContain(
      `[type-envgen] zod and type-envgen are not in your dependencies. Install: npm install zod@^4 type-envgen@^${pkg.version}`,
    );
    const generated = readFileSync(join(dir, "env.ts"), "utf8");
    expect(generated).toContain(`import { json, validateEnv } from "type-envgen";`);
    expect(generated).not.toContain("const json =");
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
    expect(help.stdout).toMatch(/@pattern/);
    expect(help.stdout).toMatch(/@minlength/);
    expect(help.stdout).toMatch(/@maxlength/);
    expect(help.stdout).toMatch(/date, datetime, ipv4, ipv6/);
    expect(help.stdout).toMatch(/httpurl, hostname/);
    expect(help.stdout).toMatch(/-w, --watch/);
  });

  it("prints the version", () => {
    expect(cli("--version").stdout.trim()).toBe(`[type-envgen] ${pkg.version}`);
  });

  it("fails on a missing input file", () => {
    const run = cli("does-not-exist.env");
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^\[type-envgen\] Input file not found: does-not-exist\.env/);
  });

  it("rejects --check with --watch", () => {
    const run = cli(envPath, "--check", "--watch");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("[type-envgen] --check and --watch can't be used together");
  });

  it("fails on a missing input file with --watch", () => {
    const run = cli("does-not-exist.env", "-w");
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^\[type-envgen\] Input file not found: does-not-exist\.env/);
  });

  it("fails on an unknown flag", () => {
    const run = cli("--nope");
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/^\[type-envgen\] .*\nRun type-envgen --help for usage\./);
  });

  describe("--check", () => {
    const upToDate = (out: string) => `[type-envgen] ✓ ${out} is up to date`;
    const outOfDate = (out: string) => `[type-envgen] ${out} is out of date, run type-envgen to regenerate`;

    it("exits 0 when output is up to date", () => {
      const out = join(outDir, "check-valid.ts");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(out, generateEnv(readFileSync(envPath, "utf8")));

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toContain(upToDate(out));
    });

    it("ignores CRLF vs LF differences", () => {
      const out = join(outDir, "check-crlf.ts");
      mkdirSync(outDir, { recursive: true });
      const crlfSource = generateEnv(readFileSync(envPath, "utf8")).replace(/\n/g, "\r\n");
      writeFileSync(out, crlfSource);

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toContain(upToDate(out));
    });

    it("keeps the user's own code in the file up to date", () => {
      const out = join(outDir, "check-custom.ts");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(out, `${generateEnv(readFileSync(envPath, "utf8"))}export const isProd = true;\n`);

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toContain(upToDate(out));
    });

    it("exits 1 when output is out of date and does not modify the file", () => {
      const out = join(outDir, "check-outdated.ts");
      mkdirSync(outDir, { recursive: true });
      const outdatedContent = generateEnv("ONLY_ONE_KEY=1");
      writeFileSync(out, outdatedContent);

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(outOfDate(out));
      expect(readFileSync(out, "utf8")).toBe(outdatedContent);
    });

    it("exits 1 when the generated parts are missing", () => {
      const out = join(outDir, "check-foreign.ts");
      mkdirSync(outDir, { recursive: true });
      const foreign = "// not a generated file\n";
      writeFileSync(out, foreign);

      const run = cli(envPath, "-o", out, "--check");
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(`Can't update ${out}`);
      expect(readFileSync(out, "utf8")).toBe(foreign);
    });

    it("exits 1 when output file does not exist", () => {
      const missing = join(outDir, "missing-check.ts");
      const run = cli(envPath, "-o", missing, "--check");
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(outOfDate(missing));
    });
  });

  it("watches and regenerates on changes, continuing after error, and exiting cleanly on SIGINT", async () => {
    const dir = join(outDir, "watch-spec-test");
    mkdirSync(dir, { recursive: true });
    const envFile = join(dir, ".env");
    const outFile = join(dir, "env.ts");
    writeFileSync(envFile, "FOO=initial\n");

    const child = spawn(process.execPath, [cliPath, envFile, "-o", outFile, "--watch"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // 1. Initial generation
    await vi.waitFor(
      () => {
        expect(readFileSync(outFile, "utf8")).toMatch(/FOO: z\.string\(\)/);
      },
      { timeout: 3000, interval: 50 },
    );

    // 2. Regeneration on valid edit, keeping the user's own code in the output
    const custom = "export const isProd = true;\n";
    writeFileSync(outFile, readFileSync(outFile, "utf8") + custom);
    writeFileSync(envFile, "FOO=initial\nPORT=3000\n");
    await vi.waitFor(
      () => {
        const out = readFileSync(outFile, "utf8");
        expect(out).toMatch(/PORT: z\.coerce\.number\(\)\.int\(\)/);
        expect(out).toContain(custom);
      },
      { timeout: 3000, interval: 50 },
    );

    // 3. Error logged on invalid tag, but process stays alive
    writeFileSync(envFile, "# @type invalid_type\nPORT=3000\n");
    await vi.waitFor(
      () => {
        expect(stderr).toMatch(/Unknown @type "invalid_type" for PORT/);
      },
      { timeout: 3000, interval: 50 },
    );

    // 4. Recovers on fix
    writeFileSync(envFile, "# @type boolean\nPORT=true\n");
    await vi.waitFor(
      () => {
        expect(readFileSync(outFile, "utf8")).toMatch(/PORT: z\.stringbool\(\)/);
      },
      { timeout: 3000, interval: 50 },
    );

    // 5. Exits cleanly on SIGINT
    const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.on("exit", (code, signal) => resolve({ code, signal }));
    });
    child.kill("SIGINT");
    const { code, signal } = await exitPromise;
    if (process.platform === "win32") {
      expect(signal).toBe("SIGINT");
    } else {
      expect(code).toBe(0);
    }

    rmSync(dir, { recursive: true, force: true });
  });
});
