import { describe, expect, it } from "vitest";
import { generateEnv } from "../generate-env/index.ts";
import { loadGenerated } from "./helpers.ts";

const { output, envSchema } = await loadGenerated("constraints");

describe("@min / @max", () => {
  it("emits bounds", () => {
    expect(output).toMatch(/PORT: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(65535\)/);
    expect(output).toMatch(/APP_NAME: z\.string\(\)\.min\(1\)/);
  });

  it("enforces bounds at parse time", () => {
    expect(envSchema.safeParse({ ...process.env, PORT: "0" }).success).toBe(false);
  });

  it("rejects bad bounds", () => {
    expect(() => generateEnv("# @min abc\nX=1")).toThrow(/@min for X must be a number/);
    expect(() => generateEnv("# @min 5\n# @max 1\nX=1")).toThrow(/greater than @max/);
    expect(() => generateEnv("# @type boolean\n# @min 1\nX=true")).toThrow(/@min is not supported for X/);
  });
});

describe("@optional", () => {
  it("allows the variable to be missing", () => {
    expect(output).toMatch(/OPTIONAL_TOKEN: z\.string\(\)\.optional\(\)/);
    const { OPTIONAL_TOKEN: _omit, ...withoutToken } = process.env;
    expect(envSchema.safeParse(withoutToken).success).toBe(true);
  });

  it("leaves untagged variables required", () => {
    expect(output).toMatch(/DATABASE_URL: z\.url\(\),/);
  });
});

describe("unknown tags", () => {
  it.each(["mni", "required"])("rejects @%s", (tag) => {
    expect(() => generateEnv(`# @${tag} 1\nX=1`)).toThrow(new RegExp(`Unknown tag @${tag} for X`));
  });
});
