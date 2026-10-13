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

  it("rejects an unknown type", () => {
    expect(() => generateEnv("# @type nope\nX=1")).toThrow(/Unknown @type "nope" for X/);
  });

  it("is cancelled by a blank line", () => {
    expect(generateEnv("# @type string\n\nX=1")).toMatch(/X: z\.coerce\.number\(\)\.int\(\)/);
  });
});
