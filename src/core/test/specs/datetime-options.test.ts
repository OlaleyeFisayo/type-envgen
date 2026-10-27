import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateEnv } from "../../generate-env/index.ts";
import { validateEnv } from "../../generate-env/validate-env.ts";

describe("@type datetime options", () => {
  it("supports @type datetime(offset)", () => {
    const output = generateEnv("# @type datetime(offset)\nLAUNCH_AT=2026-01-31T10:00:00+01:00");
    expect(output).toMatch(/LAUNCH_AT: z\.iso\.datetime\(\{ offset: true \}\)/);
  });

  it("supports @type datetime(local, precision=0)", () => {
    const output = generateEnv("# @type datetime(local, precision=0)\nCUTOFF=2026-01-31T10:00:00");
    expect(output).toMatch(/CUTOFF: z\.iso\.datetime\(\{ local: true, precision: 0 \}\)/);
  });

  it("supports @type datetime(precision=3)", () => {
    const output = generateEnv("# @type datetime(precision=3)\nEVENT_AT=2026-01-31T10:00:00.123Z");
    expect(output).toMatch(/EVENT_AT: z\.iso\.datetime\(\{ precision: 3 \}\)/);
  });

  it("supports combining offset and local", () => {
    const output = generateEnv("# @type datetime(offset, local)\nTIMESTAMP=2026-01-31T10:00:00");
    expect(output).toMatch(/TIMESTAMP: z\.iso\.datetime\(\{ offset: true, local: true \}\)/);
  });

  it("is case-insensitive for type name and options", () => {
    const output = generateEnv("# @type DATETIME(LOCAL, PRECISION=2)\nSTAMP=2026-01-31T10:00:00.12");
    expect(output).toMatch(/STAMP: z\.iso\.datetime\(\{ local: true, precision: 2 \}\)/);
  });

  it("rejects unknown options", () => {
    expect(() => generateEnv("# @type datetime(timezone)\nX=2026-01-31T10:00:00Z")).toThrow(
      /Unknown parameter "timezone" in @type datetime for X/,
    );
  });

  it("rejects empty options in datetime()", () => {
    expect(() => generateEnv("# @type datetime()\nX=2026-01-31T10:00:00Z")).toThrow(
      /@type datetime requires options for X/,
    );
  });

  it("rejects negative or non-integer precision", () => {
    expect(() => generateEnv("# @type datetime(precision=-1)\nX=2026-01-31T10:00:00Z")).toThrow(
      /Invalid precision "-1" in @type datetime for X/,
    );
    expect(() => generateEnv("# @type datetime(precision=abc)\nX=2026-01-31T10:00:00Z")).toThrow(
      /Invalid precision "abc" in @type datetime for X/,
    );
  });

  it("validates @default against datetime options", () => {
    const output = generateEnv('# @type datetime(offset)\n# @default "2026-01-31T10:00:00+01:00"\nX=');
    expect(output).toMatch(/X: z\.iso\.datetime\(\{ offset: true \}\)\.default\("2026-01-31T10:00:00\+01:00"\)/);

    // Bad default fails
    expect(() => generateEnv('# @type datetime(offset)\n# @default "not-a-datetime"\nX=')).toThrow(
      /@default for X must be a valid ISO datetime/,
    );

    // Plain datetime rejects offset default
    expect(() => generateEnv('# @type datetime\n# @default "2026-01-31T10:00:00+01:00"\nX=')).toThrow(
      /@default for X must be a valid ISO datetime/,
    );
  });

  it("supports string-like tags (@min, @max, @pattern)", () => {
    const output = generateEnv(
      '# @type datetime(offset)\n# @min 10\n# @max 40\n# @pattern "^[0-9]{4}-"\nX=2026-01-31T10:00:00+01:00',
    );
    expect(output).toMatch(
      /X: z\.iso\.datetime\(\{ offset: true \}\)\.min\(10\)\.max\(40\)\.regex\(\/\^\[0-9\]\{4\}-\/\)/,
    );
  });

  it("infers datetime(offset) when sample value has timezone offset", () => {
    const output = generateEnv("OFFSET_DATE=2026-01-31T10:00:00+01:00");
    expect(output).toMatch(/OFFSET_DATE: z\.iso\.datetime\(\{ offset: true \}\)/);

    const utcOutput = generateEnv("UTC_DATE=2026-01-31T10:00:00Z");
    expect(utcOutput).toMatch(/UTC_DATE: z\.iso\.datetime\(\)/);
  });

  it("validates at runtime with validateEnv and reports ISO datetime error label without leaking secret value", () => {
    const schema = z.object({
      LAUNCH: z.iso.datetime({ offset: true }),
    });

    // Valid parses cleanly
    expect(validateEnv(schema, { LAUNCH: "2026-01-31T10:00:00+01:00" })).toEqual({
      LAUNCH: "2026-01-31T10:00:00+01:00",
    });

    // Invalid throws prefixed error naming the field and label
    try {
      validateEnv(schema, { LAUNCH: "secret-invalid-token" });
      expect.unreachable();
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain("LAUNCH: must be a valid ISO datetime");
      expect(msg).not.toContain("secret-invalid-token");
    }
  });
});
