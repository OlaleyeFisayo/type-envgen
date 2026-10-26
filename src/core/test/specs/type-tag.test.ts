import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";
import { loadGenerated } from "../utils/helpers.ts";

const { output, env } = await loadGenerated("type-tag");

describe("@type", () => {
  it("overrides inference", () => {
    expect(env.VERBOSE).toBe(true); // would be a number without the tag
  });

  it("supports enum(...)", () => {
    expect(output).toMatch(/LOG_LEVEL: z\.enum\(\["debug","info","warn","error"\]\)/);
  });

  it("supports misc string formats", () => {
    expect(output).toMatch(/SUPPORT_PHONE: z\.e164\(\)/);
    expect(output).toMatch(/NOTIFICATION_ICON: z\.emoji\(\)/);
    expect(output).toMatch(/DEFAULT_CURRENCY: z\.currencyCode\(\)/);
    expect(output).toMatch(/PAYOUT_IBAN: z\.iban\(\)/);
    expect(output).toMatch(/TEST_CARD: z\.creditCard\(\)/);
    expect(env.SUPPORT_PHONE).toBe("+14155552671");
    expect(env.NOTIFICATION_ICON).toBe("🚀");
    expect(env.DEFAULT_CURRENCY).toBe("USD");
    expect(env.PAYOUT_IBAN).toBe("DE89370400440532013000");
    expect(env.TEST_CARD).toBe("4532015112830366");
  });

  it("treats misc formats as string-like", () => {
    expect(generateEnv("# @type currencycode\n# @minlength 3\n# @pattern ^[A-Z]{3}$\nX=USD")).toContain(
      "X: z.currencyCode().min(3).regex(/^[A-Z]{3}$/)",
    );
  });

  it("supports jwt and jwt(alg)", () => {
    expect(generateEnv("# @type jwt\nSERVICE_TOKEN=eyJ")).toContain("SERVICE_TOKEN: z.jwt()");
    expect(generateEnv("# @type jwt(HS256)\nSIGNED_TOKEN=eyJ")).toContain('SIGNED_TOKEN: z.jwt({ alg: "HS256" })');
    expect(generateEnv("# @type jwt(hs256)\nSIGNED_TOKEN=eyJ")).toContain('SIGNED_TOKEN: z.jwt({ alg: "HS256" })');
    expect(generateEnv("# @type jwt(RS256)\nSIGNED_TOKEN=eyJ")).toContain('SIGNED_TOKEN: z.jwt({ alg: "RS256" })');
    expect(generateEnv("# @type jwt(ES256)\nSIGNED_TOKEN=eyJ")).toContain('SIGNED_TOKEN: z.jwt({ alg: "ES256" })');
    expect(() => generateEnv("# @type jwt(unknown)\nSIGNED_TOKEN=eyJ")).toThrow(
      /Unknown JWT algorithm "unknown" for SIGNED_TOKEN/,
    );
  });

  it("supports hash(alg) and hash(alg, enc)", () => {
    expect(generateEnv("# @type hash(sha256)\nASSET_SHA256=9f86")).toContain('ASSET_SHA256: z.hash("sha256")');
    expect(generateEnv("# @type hash(sha256, base64)\nASSET_DIGEST=n4bQ")).toContain(
      'ASSET_DIGEST: z.hash("sha256", { enc: "base64" })',
    );
    expect(generateEnv("# @type hash(sha256, hex)\nASSET_HEX=9f86")).toContain('ASSET_HEX: z.hash("sha256")');
    expect(generateEnv("# @type hash(SHA256, BASE64URL)\nASSET_URL=n4bQ")).toContain(
      'ASSET_URL: z.hash("sha256", { enc: "base64url" })',
    );

    for (const alg of ["md5", "sha1", "sha256", "sha384", "sha512"]) {
      expect(generateEnv(`# @type hash(${alg})\nH=abc`)).toContain(`H: z.hash("${alg}")`);
    }

    expect(() => generateEnv("# @type hash\nH=abc")).toThrow(/@type hash requires an algorithm parameter for H/);
    expect(() => generateEnv("# @type hash()\nH=abc")).toThrow(/@type hash requires an algorithm parameter for H/);
    expect(() => generateEnv("# @type hash(crc32)\nH=abc")).toThrow(/Unknown hash algorithm "crc32" for H/);
    expect(() => generateEnv("# @type hash(sha256, utf8)\nH=abc")).toThrow(/Unknown hash encoding "utf8" for H/);
  });

  it("supports constraints and pattern on jwt and hash", () => {
    const jwtWithConstraints = generateEnv("# @type jwt\n# @minlength 10\n# @maxlength 500\nTOKEN=eyJ");
    expect(jwtWithConstraints).toContain("TOKEN: z.jwt().min(10).max(500)");

    const hashWithPattern = generateEnv(
      "# @type hash(sha256)\n# @pattern /^[0-9a-f]+$/\n# @min 64\nH=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
    expect(hashWithPattern).toContain('H: z.hash("sha256").min(64).regex(/^[0-9a-f]+$/)');
  });

  it("supports network formats", () => {
    expect(output).toMatch(/CUSTOM_CIDRV4: z\.cidrv4\(\)/);
    expect(output).toMatch(/CUSTOM_CIDRV6: z\.cidrv6\(\)/);
    expect(output).toMatch(/DASH_MAC: z\.mac\(\{ delimiter: "-" \}\)/);
    expect(generateEnv("# @type mac\nX=00:1A:2B:3C:4D:5E")).toMatch(/X: z\.mac\(\)/);
  });

  it("rejects unknown mac delimiters", () => {
    expect(() => generateEnv("# @type mac(x)\nX=00:1A:2B:3C:4D:5E")).toThrow(/Unknown MAC delimiter "x" for X/);
    expect(() => generateEnv("# @type mac()\nX=00:1A:2B:3C:4D:5E")).toThrow(/Unknown MAC delimiter "" for X/);
  });

  it("rejects an unknown type", () => {
    expect(() => generateEnv("# @type nope\nX=1")).toThrow(/Unknown @type "nope" for X/);
  });

  it("is cancelled by a blank line", () => {
    expect(generateEnv("# @type string\n\nX=1")).toMatch(/X: z\.coerce\.number\(\)\.int\(\)/);
  });

  it("supports ID types (case-insensitive)", () => {
    expect(generateEnv("# @type nanoid\nX=a")).toMatch(/X: z\.nanoid\(\)/);
    expect(generateEnv("# @type NanoID\nX=a")).toMatch(/X: z\.nanoid\(\)/);
    expect(generateEnv("# @type cuid\nX=a")).toMatch(/X: z\.cuid\(\)/);
    expect(generateEnv("# @type cuid2\nX=a")).toMatch(/X: z\.cuid2\(\)/);
    expect(generateEnv("# @type ulid\nX=a")).toMatch(/X: z\.ulid\(\)/);
    expect(generateEnv("# @type ULID\nX=a")).toMatch(/X: z\.ulid\(\)/);
    expect(generateEnv("# @type ksuid\nX=a")).toMatch(/X: z\.ksuid\(\)/);
    expect(generateEnv("# @type xid\nX=a")).toMatch(/X: z\.xid\(\)/);
  });

  it("supports bounds on ID types", () => {
    expect(generateEnv("# @type ulid\n# @min 26\n# @max 26\nX=01ARZ3NDEKTSV4RRFFQ69G5FAV")).toMatch(
      /X: z\.ulid\(\)\.min\(26\)\.max\(26\)/,
    );
  });

  it("supports base64, base64url, and hex", () => {
    expect(output).toMatch(/BASE64_KEY: z\.base64\(\)/);
    expect(output).toMatch(/BASE64URL_SECRET: z\.base64url\(\)/);
    expect(output).toMatch(/HEX_SECRET: z\.hex\(\)/);
    expect(env.BASE64_KEY).toBe("q83vEjRWeJA=");
    expect(env.BASE64URL_SECRET).toBe("q83vEjRWeJA");
    expect(env.HEX_SECRET).toBe("deadbeef01");
  });

  it("is case-insensitive for encoding types", () => {
    expect(generateEnv("# @type BASE64\nX=q83vEjRWeJA=")).toMatch(/X: z\.base64\(\)/);
    expect(generateEnv("# @type Base64Url\nX=q83vEjRWeJA")).toMatch(/X: z\.base64url\(\)/);
    expect(generateEnv("# @type HEX\nX=deadbeef01")).toMatch(/X: z\.hex\(\)/);
  });

  it("rejects unknown parameters on encoding types", () => {
    expect(() => generateEnv("# @type base64(8)\nX=q83vEjRWeJA=")).toThrow(/Unknown @type "base64\(8\)" for X/);
    expect(() => generateEnv("# @type hex(16)\nX=deadbeef01")).toThrow(/Unknown @type "hex\(16\)" for X/);
  });

  it("supports httpurl and hostname (case-insensitive)", () => {
    expect(generateEnv("# @type httpurl\nAPI_URL=https://api.example.com")).toMatch(/API_URL: z\.httpUrl\(\)/);
    expect(generateEnv("# @type HTTPURL\nAPI_URL=https://api.example.com")).toMatch(/API_URL: z\.httpUrl\(\)/);
    expect(generateEnv("# @type hostname\nDB_HOST=db.internal")).toMatch(/DB_HOST: z\.hostname\(\)/);
    expect(generateEnv("# @type HOSTNAME\nDB_HOST=db.internal")).toMatch(/DB_HOST: z\.hostname\(\)/);
  });

  it("supports bounds on httpurl and hostname", () => {
    expect(generateEnv("# @type httpurl\n# @min 10\n# @max 100\nAPI_URL=https://api.example.com")).toMatch(
      /API_URL: z\.httpUrl\(\)\.min\(10\)\.max\(100\)/,
    );
    expect(generateEnv("# @type hostname\n# @minlength 3\n# @maxlength 30\nDB_HOST=db.internal")).toMatch(
      /DB_HOST: z\.hostname\(\)\.min\(3\)\.max\(30\)/,
    );
  });
});
