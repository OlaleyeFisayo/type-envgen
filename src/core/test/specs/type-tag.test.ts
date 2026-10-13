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
});
