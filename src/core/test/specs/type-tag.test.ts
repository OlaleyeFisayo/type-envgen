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
