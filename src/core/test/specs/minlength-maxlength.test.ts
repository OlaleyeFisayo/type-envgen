import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";

describe("@minlength / @maxlength", () => {
  it("emits .min(n) and .max(n) on strings", () => {
    const out = generateEnv("# @minlength 8\n# @maxlength 64\nJWT_SECRET=please-change-me-to-something-long-enough");
    expect(out).toMatch(/JWT_SECRET: z\.string\(\)\.min\(8\)\.max\(64\)/);
  });

  it("supports single bounds and zero length", () => {
    expect(generateEnv("# @minlength 8\nKEY=value")).toMatch(/KEY: z\.string\(\)\.min\(8\)/);
    expect(generateEnv("# @maxlength 64\nKEY=value")).toMatch(/KEY: z\.string\(\)\.max\(64\)/);
    expect(generateEnv("# @minlength 0\nKEY=value")).toMatch(/KEY: z\.string\(\)\.min\(0\)/);
  });

  it("supports string-like schemas", () => {
    expect(generateEnv("# @type url\n# @minlength 10\n# @maxlength 100\nX=https://api.com")).toMatch(
      /X: z\.url\(\)\.min\(10\)\.max\(100\)/,
    );
    expect(generateEnv("# @type email\n# @minlength 5\n# @maxlength 50\nX=a@b.com")).toMatch(
      /X: z\.email\(\)\.min\(5\)\.max\(50\)/,
    );
    expect(
      generateEnv("# @type uuid\n# @minlength 36\n# @maxlength 36\nX=550e8400-e29b-41d4-a716-446655440000"),
    ).toMatch(/X: z\.uuid\(\)\.min\(36\)\.max\(36\)/);
    expect(generateEnv("# @type date\n# @minlength 10\n# @maxlength 10\nX=2026-01-31")).toMatch(
      /X: z\.iso\.date\(\)\.min\(10\)\.max\(10\)/,
    );
    expect(generateEnv("# @type datetime\n# @minlength 20\n# @maxlength 30\nX=2026-01-31T10:00:00Z")).toMatch(
      /X: z\.iso\.datetime\(\)\.min\(20\)\.max\(30\)/,
    );
    expect(generateEnv("# @type ipv4\n# @minlength 7\n# @maxlength 15\nX=192.168.0.1")).toMatch(
      /X: z\.ipv4\(\)\.min\(7\)\.max\(15\)/,
    );
    expect(generateEnv("# @type ipv6\n# @minlength 3\n# @maxlength 39\nX=::1")).toMatch(
      /X: z\.ipv6\(\)\.min\(3\)\.max\(39\)/,
    );
  });

  it("combines with @optional", () => {
    const out = generateEnv("# @minlength 8\n# @maxlength 64\n# @optional\nTOKEN=secret");
    expect(out).toMatch(/TOKEN: z\.string\(\)\.min\(8\)\.max\(64\)\.optional\(\)/);
  });

  it("supports backwards-compatible @min and @max aliases on strings", () => {
    const out = generateEnv("# @min 8\n# @max 64\nKEY=value");
    expect(out).toMatch(/KEY: z\.string\(\)\.min\(8\)\.max\(64\)/);
  });

  it("supports mixing alias and length tags", () => {
    expect(generateEnv("# @minlength 8\n# @max 64\nKEY=value")).toMatch(/KEY: z\.string\(\)\.min\(8\)\.max\(64\)/);
    expect(generateEnv("# @min 8\n# @maxlength 64\nKEY=value")).toMatch(/KEY: z\.string\(\)\.min\(8\)\.max\(64\)/);
  });

  it("validates @default against length bounds", () => {
    expect(generateEnv("# @minlength 3\n# @maxlength 10\n# @default hello\nKEY=value")).toMatch(
      /KEY: z\.string\(\)\.min\(3\)\.max\(10\)\.default\("hello"\)/,
    );
    expect(() => generateEnv("# @minlength 8\n# @default short\nKEY=value")).toThrow(
      /@default length \(5\) is less than @minlength \(8\) for KEY/,
    );
    expect(() => generateEnv("# @maxlength 4\n# @default toolong\nKEY=value")).toThrow(
      /@default length \(7\) is greater than @maxlength \(4\) for KEY/,
    );
    expect(() =>
      generateEnv("# @type url\n# @minlength 30\n# @default https://example.com\nURL=https://example.com/path"),
    ).toThrow(/@default length \(19\) is less than @minlength \(30\) for URL/);
  });

  describe("errors", () => {
    it("rejects minlength > maxlength", () => {
      expect(() => generateEnv("# @minlength 64\n# @maxlength 8\nKEY=value")).toThrow(
        /@minlength \(64\) is greater than @maxlength \(8\) for KEY/,
      );
      expect(() => generateEnv("# @minlength 20\n# @max 10\nKEY=value")).toThrow(
        /@minlength \(20\) is greater than @max \(10\) for KEY/,
      );
    });

    it.each([
      ["negative length", "# @minlength -1\nX=str", /@minlength for X must be a non-negative integer, got "-1"/],
      ["negative maxlength", "# @maxlength -5\nX=str", /@maxlength for X must be a non-negative integer, got "-5"/],
      ["float length", "# @minlength 1.5\nX=str", /@minlength for X must be a non-negative integer, got "1.5"/],
      ["float maxlength", "# @maxlength 3.14\nX=str", /@maxlength for X must be a non-negative integer, got "3.14"/],
      ["non-numeric string", "# @minlength abc\nX=str", /@minlength for X must be a non-negative integer, got "abc"/],
      ["empty argument", "# @minlength\nX=str", /@minlength for X must be a non-negative integer, got ""/],
    ])("rejects invalid length: %s", (_name, src, message) => {
      expect(() => generateEnv(src)).toThrow(message);
    });

    it("rejects combining alias and length tag for the same bound", () => {
      expect(() => generateEnv("# @min 5\n# @minlength 8\nX=hello")).toThrow(
        /Cannot combine @min and @minlength for X/,
      );
      expect(() => generateEnv("# @max 5\n# @maxlength 8\nX=hello")).toThrow(
        /Cannot combine @max and @maxlength for X/,
      );
    });

    it.each([
      ["number", "# @type number\n# @minlength 5\nX=123.45", /@minlength is not supported for X/],
      ["int", "# @type int\n# @maxlength 5\nX=123", /@maxlength is not supported for X/],
      ["boolean", "# @type boolean\n# @minlength 1\nX=true", /@minlength is not supported for X/],
      ["enum", "# @type enum(a, b)\n# @maxlength 5\nX=a", /@maxlength is not supported for X/],
      ["json", '# @minlength 5\nX={"a":1}', /@minlength is not supported for X/],
    ])("rejects @minlength/@maxlength on non-string schema: %s", (_name, src, message) => {
      expect(() => generateEnv(src)).toThrow(message);
    });
  });
});
