import { describe, expect, it } from "vitest";
import { generateEnv } from "../generate-env/index.ts";
import { loadGenerated } from "./helpers.ts";

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
});
