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

  it("rejects an unknown type", () => {
    expect(() => generateEnv("# @type nope\nX=1")).toThrow(/Unknown @type "nope" for X/);
  });

  it("is cancelled by a blank line", () => {
    expect(generateEnv("# @type string\n\nX=1")).toMatch(/X: z\.coerce\.number\(\)\.int\(\)/);
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
});
