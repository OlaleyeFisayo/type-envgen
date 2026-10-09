import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";
import { outDir } from "../utils/helpers.ts";

describe("@pattern", () => {
  it("emits .regex(...) on string schemas", () => {
    const output = generateEnv(["# @pattern ^sk_(live|test)_[A-Za-z0-9]+$", "STRIPE_KEY=sk_test_abc123"].join("\n"));
    expect(output).toContain("STRIPE_KEY: z.string().regex(/^sk_(live|test)_[A-Za-z0-9]+$/)");
  });

  it("supports slash-delimited regex literals with or without flags", () => {
    const output = generateEnv(
      [
        "# @pattern /^sk_(live|test)_[A-Za-z0-9]+$/",
        "STRIPE_KEY=sk_test_abc123",
        "# @pattern /^[a-z]+$/i",
        "CASE_INSENSITIVE=AbCdEf",
      ].join("\n"),
    );
    expect(output).toContain("STRIPE_KEY: z.string().regex(/^sk_(live|test)_[A-Za-z0-9]+$/)");
    expect(output).toContain("CASE_INSENSITIVE: z.string().regex(/^[a-z]+$/i)");
  });

  it("supports quoted patterns and strips surrounding quotes", () => {
    const output = generateEnv(["# @type string", '# @pattern "^[0-9]+$"', "DIGITS=12345"].join("\n"));
    expect(output).toContain("DIGITS: z.string().regex(/^[0-9]+$/)");
  });

  it("properly escapes forward slashes and backslashes in emitted regex", () => {
    const output = generateEnv(
      [
        "# @pattern ^/api/v[0-9]+/[a-z]+$",
        "API_PATH=/api/v1/users",
        "# @type string",
        "# @pattern ^\\d{4}-\\d{2}-\\d{2}$",
        "DATE_STRING=2026-10-09",
      ].join("\n"),
    );
    expect(output).toContain("API_PATH: z.string().regex(/^\\/api\\/v[0-9]+\\/[a-z]+$/)");
    expect(output).toContain("DATE_STRING: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)");
  });

  it("supports @pattern on url, email, and uuid schemas", () => {
    const output = generateEnv(
      [
        "# @type url",
        "# @pattern ^https://",
        "API_URL=https://api.example.com",
        "# @type email",
        "# @pattern @company\\.com$",
        "WORK_EMAIL=alice@company.com",
        "# @type uuid",
        "# @pattern ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}",
        "V4_UUID=550e8400-e29b-41d4-a716-446655440000",
      ].join("\n"),
    );
    expect(output).toContain("API_URL: z.url().regex(/^https:\\/\\//)");
    expect(output).toContain("WORK_EMAIL: z.email().regex(/@company\\.com$/)");
    expect(output).toContain("V4_UUID: z.uuid().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/)");
  });

  it("combines with @min, @max, @default, and @optional", () => {
    const output = generateEnv(
      [
        "# @min 5",
        "# @max 20",
        "# @pattern ^[a-z]+$",
        "BOUNDED_STR=abcdef",
        "# @pattern ^[a-z]+$",
        '# @default "defaultval"',
        "DEFAULTED_STR=defaultval",
        "# @pattern ^[a-z]+$",
        "# @optional",
        "OPTIONAL_STR=hello",
      ].join("\n"),
    );
    expect(output).toContain("BOUNDED_STR: z.string().min(5).max(20).regex(/^[a-z]+$/)");
    expect(output).toContain('DEFAULTED_STR: z.string().regex(/^[a-z]+$/).default("defaultval")');
    expect(output).toContain("OPTIONAL_STR: z.string().regex(/^[a-z]+$/).optional()");
  });

  it("is cancelled by a blank line", () => {
    const output = generateEnv("# @pattern ^[a-z]+$\n\nKEY=123");
    expect(output).toMatch(/KEY: z\.coerce\.number\(\)\.int\(\)/);
    expect(output).not.toContain(".regex");
  });

  it("enforces @pattern at parse time", async () => {
    const source = [
      "# @pattern ^sk_(live|test)_[A-Za-z0-9]+$",
      "STRIPE_KEY=sk_test_abc123",
      "# @pattern ^[a-z]+$",
      "# @optional",
      "OPTIONAL_SLUG=hello",
    ].join("\n");
    const output = generateEnv(source);
    const outPath = join(outDir, "pattern-runtime.ts");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, output);
    process.env.STRIPE_KEY = "sk_test_abc123";
    const { envSchema } = await import(pathToFileURL(outPath).href);

    expect(envSchema.safeParse({ STRIPE_KEY: "sk_test_abc123" }).success).toBe(true);
    expect(envSchema.safeParse({ STRIPE_KEY: "sk_live_xyz999", OPTIONAL_SLUG: "world" }).success).toBe(true);
    expect(envSchema.safeParse({ STRIPE_KEY: "invalid_key" }).success).toBe(false);
    expect(envSchema.safeParse({ STRIPE_KEY: "sk_test_abc123", OPTIONAL_SLUG: "12345" }).success).toBe(false);
  });

  it("rejects sample values that do not match @pattern", () => {
    expect(() =>
      generateEnv(["# @pattern ^sk_(live|test)_[A-Za-z0-9]+$", "STRIPE_KEY=pk_test_abc123"].join("\n")),
    ).toThrow(/Sample value "pk_test_abc123" does not match @pattern for STRIPE_KEY/);

    expect(() => generateEnv(["# @type url", "# @pattern ^https://", "API_URL=http://example.com"].join("\n"))).toThrow(
      /Sample value "http:\/\/example.com" does not match @pattern for API_URL/,
    );

    expect(() => generateEnv(["# @type string", "# @pattern ^[0-9]+$", "CODE=abc"].join("\n"))).toThrow(
      /Sample value "abc" does not match @pattern for CODE/,
    );
  });

  it("rejects invalid regex syntax", () => {
    expect(() => generateEnv("# @pattern [a-z(\nX=abc")).toThrow(/Invalid regex for X:/);
    expect(() => generateEnv("# @pattern (?<\nX=abc")).toThrow(/Invalid regex for X:/);
    expect(() => generateEnv("# @pattern /abc/invalidflag\nX=abc")).toThrow(/Invalid regex for X:/);
    expect(() => generateEnv("# @pattern\nX=abc")).toThrow(/Invalid regex for X: pattern cannot be empty/);
    expect(() => generateEnv("# @pattern   \nX=abc")).toThrow(/Invalid regex for X: pattern cannot be empty/);
  });

  it("rejects @pattern on non-string schemas", () => {
    expect(() => generateEnv("# @type int\n# @pattern ^[0-9]+$\nPORT=3000")).toThrow(
      /@pattern is not supported for PORT \(z\.coerce\.number\(\)\.int\(\)\)/,
    );
    expect(() => generateEnv("# @type number\n# @pattern ^[0-9]+$\nVAL=3.14")).toThrow(
      /@pattern is not supported for VAL \(z\.coerce\.number\(\)\)/,
    );
    expect(() => generateEnv("# @type boolean\n# @pattern ^true$\nFLAG=true")).toThrow(
      /@pattern is not supported for FLAG \(z\.stringbool\(\)\)/,
    );
    expect(() => generateEnv("# @pattern ^[0-9]+$\nPORT=3000")).toThrow(
      /@pattern is not supported for PORT \(z\.coerce\.number\(\)\.int\(\)\)/,
    );
    expect(() => generateEnv("# @type enum(a, b)\n# @pattern ^a$\nX=a")).toThrow(
      /@pattern is not supported for X \(z\.enum\(.*?\)\)/,
    );
    expect(() => generateEnv('# @type json\n# @pattern ^.*\nDATA={"a":1}')).toThrow(
      /@pattern is not supported for DATA/,
    );
  });
});
