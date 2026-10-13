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
