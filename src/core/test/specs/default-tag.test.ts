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

  it("accepts valid date, time, duration and IP defaults", () => {
    expect(generateEnv("# @type date\n# @default 2026-01-31\nX=2026-02-01")).toMatch(
      /X: z\.iso\.date\(\)\.default\("2026-01-31"\)/,
    );
    expect(generateEnv("# @type time\n# @default 02:30:00\nX=03:00:00")).toMatch(
      /X: z\.iso\.time\(\)\.default\("02:30:00"\)/,
    );
    expect(generateEnv("# @type time(precision=3)\n# @default 02:30:00.123\nX=03:00:00.456")).toMatch(
      /X: z\.iso\.time\(\{ precision: 3 \}\)\.default\("02:30:00\.123"\)/,
    );
    expect(generateEnv("# @type duration\n# @default PT15M\nX=PT30S")).toMatch(
      /X: z\.iso\.duration\(\)\.default\("PT15M"\)/,
    );
    expect(generateEnv("# @type ipv6\n# @default ::1\nX=2001:db8::1")).toMatch(/X: z\.ipv6\(\)\.default\("::1"\)/);
    expect(generateEnv("# @type ulid\n# @default 01ARZ3NDEKTSV4RRFFQ69G5FAV\nX=01ARZ3NDEKTSV4RRFFQ69G5FAV")).toMatch(
      /X: z\.ulid\(\)\.default\("01ARZ3NDEKTSV4RRFFQ69G5FAV"\)/,
    );
    expect(generateEnv("# @type e164\n# @default +14155552671\nX=+14155550000")).toMatch(
      /X: z\.e164\(\)\.default\("\+14155552671"\)/,
    );
    expect(generateEnv("# @type emoji\n# @default 🚀\nX=🎉")).toMatch(/X: z\.emoji\(\)\.default\("🚀"\)/);
    expect(generateEnv("# @type currencycode\n# @default USD\nX=EUR")).toMatch(
      /X: z\.currencyCode\(\)\.default\("USD"\)/,
    );
    expect(generateEnv("# @type iban\n# @default DE89370400440532013000\nX=DE89370400440532013000")).toMatch(
      /X: z\.iban\(\)\.default\("DE89370400440532013000"\)/,
    );
    expect(generateEnv("# @type creditcard\n# @default 4532015112830366\nX=4532015112830366")).toMatch(
      /X: z\.creditCard\(\)\.default\("4532015112830366"\)/,
    );
  });

  it("accepts valid jwt and hash defaults", () => {
    const validJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2ln";
    expect(generateEnv(`# @type jwt\n# @default ${validJwt}\nX=${validJwt}`)).toContain(
      `X: z.jwt().default("${validJwt}")`,
    );

    const validHash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    expect(generateEnv(`# @type hash(sha256)\n# @default ${validHash}\nX=${validHash}`)).toContain(
      `X: z.hash("sha256").default("${validHash}")`,
    );
  });

  it("accepts valid network defaults", () => {
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

  it("accepts valid httpurl and hostname defaults", () => {
    expect(generateEnv("# @type httpurl\n# @default https://example.com\nX=https://api.example.com")).toMatch(
      /X: z\.httpUrl\(\)\.default\("https:\/\/example\.com"\)/,
    );
    expect(generateEnv("# @type hostname\n# @default db.internal\nX=localhost")).toMatch(
      /X: z\.hostname\(\)\.default\("db\.internal"\)/,
    );
    expect(
      generateEnv(
        "# @type uuid(v7)\n# @default 0190a5d2-7c3b-7d4e-9f00-1234567890ab\nX=0190a5d2-7c3b-7d4e-9f00-1234567890ac",
      ),
    ).toMatch(/X: z\.uuid\(\{ version: "v7" \}\)\.default\("0190a5d2-7c3b-7d4e-9f00-1234567890ab"\)/);
    expect(
      generateEnv(
        "# @type guid\n# @default 00000000-0000-0000-0000-000000000001\nX=00000000-0000-0000-0000-000000000002",
      ),
    ).toMatch(/X: z\.guid\(\)\.default\("00000000-0000-0000-0000-000000000001"\)/);
  });

  describe("errors", () => {
    it.each([
      ["a missing value", "# @default\nX=1", /@default for X requires a value/],
      ["@optional", "# @default 3000\n# @optional\nX=3000", /Cannot combine @default and @optional for X/],
      ["a non-integer", "# @type int\n# @default abc\nX=1", /@default for X must be an integer/],
      ["a non-number", "# @type number\n# @default abc\nX=1.5", /@default for X must be a number/],
      ["a non-boolean", "# @type boolean\n# @default nope\nX=true", /@default for X must be a boolean/],
      ["a bad URL", "# @type url\n# @default not-a-url\nX=https://api.com", /@default for X must be a valid URL/],
      [
        "a bad HTTP URL",
        "# @type httpurl\n# @default ftp://example.com\nX=https://api.com",
        /@default for X must be a valid HTTP URL/,
      ],
      [
        "a bad hostname",
        "# @type hostname\n# @default -invalid\nX=db.internal",
        /@default for X must be a valid hostname/,
      ],
      ["a bad email", "# @type email\n# @default not-an-email\nX=a@b.com", /@default for X must be a valid email/],
      [
        "a bad email preset",
        "# @type email(html5)\n# @default not-an-email\nX=a@b.com",
        /@default for X must be a valid email/,
      ],
      [
        "a bad UUID",
        "# @type uuid\n# @default not-a-uuid\nX=550e8400-e29b-41d4-a716-446655440000",
        /@default for X must be a valid UUID/,
      ],
      [
        "a bad nanoid",
        "# @type nanoid\n# @default bad!\nX=V1StGXR8_Z5jdHi6B-myT",
        /@default for X must be a valid nanoid/,
      ],
      [
        "a bad cuid",
        "# @type cuid\n# @default bad!\nX=cjh40te0g0000305kzqnhsuk8",
        /@default for X must be a valid cuid/,
      ],
      [
        "a bad cuid2",
        "# @type cuid2\n# @default BAD!\nX=clh0w8820000008l07bzg81u8",
        /@default for X must be a valid cuid2/,
      ],
      [
        "a bad ULID",
        "# @type ulid\n# @default bad!\nX=01ARZ3NDEKTSV4RRFFQ69G5FAV",
        /@default for X must be a valid ULID/,
      ],
      [
        "a bad KSUID",
        "# @type ksuid\n# @default bad!\nX=0ujtsYcgvSTUXCEdGWt0JIu2T1s",
        /@default for X must be a valid KSUID/,
      ],
      ["a bad XID", "# @type xid\n# @default bad!\nX=9m4e2mr0ui3e8a215n4g", /@default for X must be a valid XID/],
      [
        "a bad uuid(v7)",
        "# @type uuid(v7)\n# @default 550e8400-e29b-41d4-a716-446655440000\nX=0190a5d2-7c3b-7d4e-9f00-1234567890ab",
        /@default for X must be a valid UUID/,
      ],
      [
        "a bad GUID",
        "# @type guid\n# @default not-a-guid\nX=00000000-0000-0000-0000-000000000001",
        /@default for X must be a valid GUID/,
      ],
      ["a bad date", "# @type date\n# @default notadate\nX=2026-01-31", /@default for X must be a valid ISO date/],
      [
        "a bad datetime",
        "# @type datetime\n# @default 2026-01-31\nX=2026-01-31T10:00:00Z",
        /@default for X must be a valid ISO datetime/,
      ],
      ["a bad time", "# @type time\n# @default notatime\nX=02:30:00", /@default for X must be a valid ISO time/],
      [
        "a bad time precision",
        "# @type time(precision=3)\n# @default 02:30:00\nX=02:30:00.123",
        /@default for X must be a valid ISO time/,
      ],
      [
        "a bad duration",
        "# @type duration\n# @default notaduration\nX=PT30S",
        /@default for X must be a valid ISO duration/,
      ],
      ["a bad IPv4", "# @type ipv4\n# @default 999.9.9.9\nX=10.0.0.1", /@default for X must be a valid IPv4 address/],
      ["a bad IPv6", "# @type ipv6\n# @default nope\nX=::1", /@default for X must be a valid IPv6 address/],
      [
        "a bad e164",
        "# @type e164\n# @default notaphone\nX=+14155552671",
        /@default for X must be a valid E\.164 number/,
      ],
      ["a bad emoji", "# @type emoji\n# @default notanemoji\nX=🚀", /@default for X must be a valid emoji/],
      [
        "a bad currency code",
        "# @type currencycode\n# @default notacurrency\nX=USD",
        /@default for X must be a valid currency code/,
      ],
      [
        "a bad IBAN",
        "# @type iban\n# @default notaiban\nX=DE89370400440532013000",
        /@default for X must be a valid IBAN/,
      ],
      [
        "a bad credit card",
        "# @type creditcard\n# @default notacard\nX=4532015112830366",
        /@default for X must be a valid credit card number/,
      ],
      ["a bad JWT", "# @type jwt\n# @default not-a-jwt\nX=test", /@default for X must be a valid JWT/],
      [
        "a bad hash",
        "# @type hash(sha256)\n# @default not-a-hash\nX=test",
        /@default for X must be a valid sha256 hash/,
      ],
      [
        "a bad base64 hash",
        "# @type hash(sha256, base64)\n# @default not-base64-hash\nX=test",
        /@default for X must be a valid sha256 hash \(base64\)/,
      ],
      [
        "a bad base64",
        "# @type base64\n# @default not-valid-base64!\nX=q83vEjRWeJA=",
        /@default for X must be a valid base64 string/,
      ],
      [
        "a bad base64url",
        "# @type base64url\n# @default bad+base64=\nX=q83vEjRWeJA",
        /@default for X must be a valid base64url string/,
      ],
      ["a bad hex", "# @type hex\n# @default nothex\nX=deadbeef01", /@default for X must be a valid hex string/],
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
