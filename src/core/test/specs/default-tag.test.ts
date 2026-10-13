import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";
import { loadGenerated } from "../utils/helpers.ts";

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

  it("accepts valid date and IP defaults", () => {
    expect(generateEnv("# @type date\n# @default 2026-01-31\nX=2026-02-01")).toMatch(
      /X: z\.iso\.date\(\)\.default\("2026-01-31"\)/,
    );
    expect(generateEnv("# @type ipv6\n# @default ::1\nX=2001:db8::1")).toMatch(/X: z\.ipv6\(\)\.default\("::1"\)/);
    expect(generateEnv("# @type cidrv4\n# @default 10.0.0.0/8\nX=192.168.0.0/16")).toMatch(
      /X: z\.cidrv4\(\)\.default\("10\.0\.0\.0\/8"\)/,
    );
    expect(generateEnv("# @type cidrv6\n# @default 2001:db8::/32\nX=fe80::/64")).toMatch(
      /X: z\.cidrv6\(\)\.default\("2001:db8::\/32"\)/,
    );
    expect(generateEnv("# @type mac\n# @default 00:1A:2B:3C:4D:5E\nX=11:22:33:44:55:66")).toMatch(
      /X: z\.mac\(\)\.default\("00:1A:2B:3C:4D:5E"\)/,
    );
    expect(generateEnv("# @type mac(-)\n# @default 00-1A-2B-3C-4D-5E\nX=11-22-33-44-55-66")).toMatch(
      /X: z\.mac\(\{ delimiter: "-" \}\)\.default\("00-1A-2B-3C-4D-5E"\)/,
    );
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
      ["a bad date", "# @type date\n# @default notadate\nX=2026-01-31", /@default for X must be a valid ISO date/],
      [
        "a bad datetime",
        "# @type datetime\n# @default 2026-01-31\nX=2026-01-31T10:00:00Z",
        /@default for X must be a valid ISO datetime/,
      ],
      ["a bad IPv4", "# @type ipv4\n# @default 999.9.9.9\nX=10.0.0.1", /@default for X must be a valid IPv4 address/],
      ["a bad IPv6", "# @type ipv6\n# @default nope\nX=::1", /@default for X must be a valid IPv6 address/],
      [
        "a bad CIDRv4",
        "# @type cidrv4\n# @default 999.9.9.9/8\nX=10.0.0.0/8",
        /@default for X must be a valid IPv4 CIDR block/,
      ],
      [
        "a bad CIDRv6",
        "# @type cidrv6\n# @default nope/64\nX=2001:db8::/32",
        /@default for X must be a valid IPv6 CIDR block/,
      ],
      [
        "a bad MAC",
        "# @type mac\n# @default not-a-mac\nX=00:1A:2B:3C:4D:5E",
        /@default for X must be a valid MAC address/,
      ],
      [
        "a bad MAC with delimiter",
        "# @type mac(-)\n# @default 00:1A:2B:3C:4D:5E\nX=00-1A-2B-3C-4D-5E",
        /@default for X must be a valid MAC address/,
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
