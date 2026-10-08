import { describe, expect, it } from "vitest";
import { generateEnv } from "../generate-env/index.ts";
import { loadGenerated } from "./helpers.ts";

const { output, envSchema } = await loadGenerated("default-tag");

describe("@default", () => {
  it("emits .default(...)", () => {
    expect(output).toMatch(/DEFAULT_PORT: z\.coerce\.number\(\)\.int\(\)\.default\(8080\)/);
    expect(output).toMatch(/DEFAULT_HOST: z\.string\(\)\.default\("localhost"\)/);
  });

  it("falls back to the default when the variable is missing", () => {
    const { DEFAULT_PORT: _p, DEFAULT_HOST: _h, ...rest } = process.env;
    const parsed = envSchema.parse(rest);
    expect(parsed.DEFAULT_PORT).toBe(8080);
    expect(parsed.DEFAULT_HOST).toBe("localhost");
  });

  describe("errors", () => {
    it.each([
      ["a missing value", "# @default\nX=1", /@default for X requires a value/],
      ["@optional", "# @default 3000\n# @optional\nX=3000", /Cannot combine @default and @optional for X/],
      ["a non-integer", "# @type int\n# @default abc\nX=1", /@default for X must be an integer/],
      ["a non-number", "# @type number\n# @default abc\nX=1.5", /@default for X must be a number/],
      ["a non-boolean", "# @type boolean\n# @default nope\nX=true", /@default for X must be a boolean/],
      ["a bad URL", "# @type url\n# @default not-a-url\nX=https://api.com", /@default for X must be a valid URL/],
      ["a bad email", "# @type email\n# @default not-an-email\nX=a@b.com", /@default for X must be a valid email/],
      [
        "a bad UUID",
        "# @type uuid\n# @default not-a-uuid\nX=550e8400-e29b-41d4-a716-446655440000",
        /@default for X must be a valid UUID/,
      ],
      ["a non-member enum", "# @type enum(a, b)\n# @default c\nX=a", /@default "c" for X is not in enum/],
      ["invalid JSON", '# @default {bad json}\nX={"a":1}', /@default for X must be valid JSON/],
      ["below @min", "# @min 10\n# @default 5\nX=10", /less than @min/],
      ["above @max", "# @max 5\n# @default 10\nX=5", /greater than @max/],
      ["a string shorter than @min", "# @min 5\n# @default hi\nX=hello", /less than @min/],
      ["a string longer than @max", "# @max 3\n# @default hello\nX=hi", /greater than @max/],
    ])("rejects %s", (_name, src, message) => {
      expect(() => generateEnv(src)).toThrow(message);
    });
  });
});
