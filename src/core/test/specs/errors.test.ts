import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { json } from "../../generate-env/json.ts";
import { validateEnv } from "../../generate-env/validate-env.ts";

// npm test builds dist first, so the real exit path runs in a child process.
const root = join(import.meta.dirname, "../../../..");
const distIndex = pathToFileURL(join(root, "dist/index.js")).href;

function errorOf(schema: z.ZodType, source: Record<string, unknown>): string {
  try {
    validateEnv(schema, source);
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error("expected validateEnv to throw");
}

describe("validateEnv errors", () => {
  it("returns parsed data when valid", () => {
    expect(validateEnv(z.object({ PORT: z.coerce.number().int() }), { PORT: "3000" })).toEqual({ PORT: 3000 });
  });

  it("lists every problem in one prefixed message", () => {
    const schema = z.object({ A: z.string(), B: z.coerce.number() });
    expect(errorOf(schema, {})).toBe("[type-envgen] Invalid environment variables:\n  A: missing\n  B: missing");
  });

  it("prints and exits with code 1 when validating process.env", () => {
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { validateEnv } from ${JSON.stringify(distIndex)};
        import { z } from "zod";
        validateEnv(z.object({ TYPE_ENVGEN_UNSET: z.string() }), process.env);`,
      ],
      { encoding: "utf8", cwd: root },
    );
    expect(child.status).toBe(1);
    expect(child.stderr.trim()).toBe("[type-envgen] Invalid environment variables:\n  TYPE_ENVGEN_UNSET: missing");
  });

  it.each([
    ["int", z.coerce.number().int(), "1.5", "must be a whole number"],
    ["number", z.coerce.number(), "abc", "must be a number"],
    ["boolean", z.stringbool(), "maybe", "must be true or false"],
    ["enum", z.enum(["a", "b"]), "c", "must be one of: a, b"],
    ["url", z.url(), "nope", "must be a valid URL"],
    ["httpurl", z.httpUrl(), "ftp://example.com", "must be a valid URL"],
    ["hostname", z.hostname(), "invalid_host", "must be a valid hostname"],
    ["email", z.email(), "nope", "must be a valid email"],
    ["uuid", z.uuid(), "nope", "must be a valid UUID"],
    ["date", z.iso.date(), "nope", "must be a valid date (YYYY-MM-DD)"],
    ["datetime", z.iso.datetime(), "nope", "must be a valid ISO datetime"],
    ["ipv4", z.ipv4(), "nope", "must be a valid IPv4 address"],
    ["ipv6", z.ipv6(), "nope", "must be a valid IPv6 address"],
    ["pattern", z.string().regex(/^sk_[a-z]+$/), "nope", "must match /^sk_[a-z]+$/"],
    ["min number", z.coerce.number().min(5), "1", "must be at least 5"],
    ["max number", z.coerce.number().max(5), "9", "must be at most 5"],
    ["min length", z.string().min(3), "ab", "must be at least 3 characters"],
    ["max length", z.string().max(1), "ab", "must be at most 1 characters"],
    ["invalid json", json(z.object({ a: z.number() })), "{bad", "must be valid JSON"],
  ])("%s", (_, schema, value, message) => {
    expect(errorOf(z.object({ X: schema }), { X: value })).toContain(`  X: ${message}`);
  });

  it("names nested JSON fields", () => {
    const schema = z.object({ X: json(z.object({ n: z.number() })) });
    expect(errorOf(schema, { X: '{"n":"s"}' })).toContain("  X.n: must be a number");
  });

  it("never prints the value", () => {
    expect(errorOf(z.object({ SECRET: z.url() }), { SECRET: "hunter2-secret" })).not.toContain("hunter2");
  });
});
