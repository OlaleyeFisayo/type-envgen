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

  it("supports uuid(v1-v8) and guid", () => {
    expect(output).toMatch(/TENANT_ID: z\.uuid\(\{ version: "v7" \}\)/);
    expect(output).toMatch(/LEGACY_ID: z\.guid\(\)/);
    expect(env.TENANT_ID).toBe("0190a5d2-7c3b-7d4e-9f00-1234567890ab");
    expect(env.LEGACY_ID).toBe("00000000-0000-0000-0000-000000000001");
    for (let v = 1; v <= 8; v++) {
      expect(generateEnv(`# @type uuid(v${v})\nX=foo`)).toMatch(
        new RegExp(`X: z\\.uuid\\(\\{ version: "v${v}" \\}\\)`),
      );
    }
  });

  it("rejects an invalid uuid version", () => {
    expect(() => generateEnv("# @type uuid(v9)\nX=foo")).toThrow(
      /Invalid UUID version "v9" for X \(expected v1 to v8\)/,
    );
    expect(() => generateEnv("# @type uuid(abc)\nX=foo")).toThrow(
      /Invalid UUID version "abc" for X \(expected v1 to v8\)/,
    );
  });

  it("rejects an unknown type", () => {
    expect(() => generateEnv("# @type nope\nX=1")).toThrow(/Unknown @type "nope" for X/);
  });

  it("is cancelled by a blank line", () => {
    expect(generateEnv("# @type string\n\nX=1")).toMatch(/X: z\.coerce\.number\(\)\.int\(\)/);
  });
});
