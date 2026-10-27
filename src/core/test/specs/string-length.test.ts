import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";

describe("@min / @max on strings (length)", () => {
  it("emits .min(n) and .max(n) on strings", () => {
    const out = generateEnv("# @min 8\n# @max 64\nJWT_SECRET=please-change-me-to-something-long-enough");
    expect(out).toMatch(/JWT_SECRET: z\.string\(\)\.min\(8\)\.max\(64\)/);
  });

  it("supports single bounds and zero length", () => {
    expect(generateEnv("# @min 8\nKEY=value")).toMatch(/KEY: z\.string\(\)\.min\(8\)/);
    expect(generateEnv("# @max 64\nKEY=value")).toMatch(/KEY: z\.string\(\)\.max\(64\)/);
    expect(generateEnv("# @min 0\nKEY=value")).toMatch(/KEY: z\.string\(\)\.min\(0\)/);
  });

  it("supports string-like schemas", () => {
    expect(generateEnv("# @type url\n# @min 10\n# @max 100\nX=https://api.com")).toMatch(
      /X: z\.url\(\)\.min\(10\)\.max\(100\)/,
    );
    expect(generateEnv("# @type email\n# @min 5\n# @max 50\nX=a@b.com")).toMatch(
      /X: z\.email\(\)\.min\(5\)\.max\(50\)/,
    );
    expect(generateEnv("# @type uuid\n# @min 36\n# @max 36\nX=550e8400-e29b-41d4-a716-446655440000")).toMatch(
      /X: z\.uuid\(\)\.min\(36\)\.max\(36\)/,
    );
    expect(generateEnv("# @type date\n# @min 10\n# @max 10\nX=2026-01-31")).toMatch(
      /X: z\.iso\.date\(\)\.min\(10\)\.max\(10\)/,
    );
    expect(generateEnv("# @type ipv4\n# @min 7\n# @max 15\nX=192.168.0.1")).toMatch(
      /X: z\.ipv4\(\)\.min\(7\)\.max\(15\)/,
    );
  });

  it("combines with @optional", () => {
    const out = generateEnv("# @min 8\n# @max 64\n# @optional\nTOKEN=secret");
    expect(out).toMatch(/TOKEN: z\.string\(\)\.min\(8\)\.max\(64\)\.optional\(\)/);
  });

  it("validates @default against length bounds", () => {
    expect(generateEnv("# @min 3\n# @max 10\n# @default hello\nKEY=value")).toMatch(
      /KEY: z\.string\(\)\.min\(3\)\.max\(10\)\.default\("hello"\)/,
    );
    expect(() => generateEnv("# @min 8\n# @default short\nKEY=value")).toThrow(
      /@default length \(5\) is less than @min \(8\) for KEY/,
    );
    expect(() => generateEnv("# @max 4\n# @default toolong\nKEY=value")).toThrow(
      /@default length \(7\) is greater than @max \(4\) for KEY/,
    );
    expect(() =>
      generateEnv("# @type url\n# @min 30\n# @default https://example.com\nURL=https://example.com/path"),
    ).toThrow(/@default length \(19\) is less than @min \(30\) for URL/);
  });

  describe("errors", () => {
    it("rejects min > max", () => {
      expect(() => generateEnv("# @min 64\n# @max 8\nKEY=value")).toThrow(
        /@min \(64\) is greater than @max \(8\) for KEY/,
      );
    });

    it.each([
      ["negative min", "# @min -1\nX=str", /@min for X must be a non-negative integer, got "-1"/],
      ["negative max", "# @max -5\nX=str", /@max for X must be a non-negative integer, got "-5"/],
      ["float min", "# @min 1.5\nX=str", /@min for X must be a non-negative integer, got "1.5"/],
      ["non-numeric", "# @min abc\nX=str", /@min for X must be a non-negative integer, got "abc"/],
      ["empty argument", "# @min\nX=str", /@min for X must be a non-negative integer, got ""/],
    ])("rejects an invalid length: %s", (_name, src, message) => {
      expect(() => generateEnv(src)).toThrow(message);
    });

    it.each([
      ["boolean", "# @type boolean\n# @min 1\nX=true", /@min is not supported for X/],
      ["enum", "# @type enum(a, b)\n# @max 5\nX=a", /@max is not supported for X/],
      ["json", '# @min 5\nX={"a":1}', /@min is not supported for X/],
    ])("rejects @min / @max on %s", (_name, src, message) => {
      expect(() => generateEnv(src)).toThrow(message);
    });

    it("points the removed @minlength / @maxlength tags to @min / @max", () => {
      expect(() => generateEnv("# @minlength 8\nX=value")).toThrow(/@minlength was removed, use @min for X/);
      expect(() => generateEnv("# @maxLength 8\nX=value")).toThrow(/@maxLength was removed, use @max for X/);
    });
  });
});
