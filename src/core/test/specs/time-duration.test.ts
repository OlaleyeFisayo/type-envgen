import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";

describe("@type time and @type duration", () => {
  it("emits z.iso.time() for @type time", () => {
    const res = generateEnv("# @type time\nBACKUP_AT=02:30:00");
    expect(res).toMatch(/BACKUP_AT: z\.iso\.time\(\)/);
  });

  it("is case-insensitive", () => {
    expect(generateEnv("# @type TIME\nBACKUP_AT=02:30:00")).toMatch(/BACKUP_AT: z\.iso\.time\(\)/);
    expect(generateEnv("# @type DuRaTiOn\nTIMEOUT=PT30S")).toMatch(/TIMEOUT: z\.iso\.duration\(\)/);
  });

  it("supports time(precision=N) and time(N)", () => {
    expect(generateEnv("# @type time(precision=3)\nBACKUP_AT=02:30:00.123")).toMatch(
      /BACKUP_AT: z\.iso\.time\(\{ precision: 3 \}\)/,
    );
    expect(generateEnv("# @type time(6)\nBACKUP_AT=02:30:00.123456")).toMatch(
      /BACKUP_AT: z\.iso\.time\(\{ precision: 6 \}\)/,
    );
  });

  it("rejects invalid time parameters naming the key", () => {
    expect(() => generateEnv("# @type time(invalid)\nBACKUP_AT=02:30:00")).toThrow(
      /Invalid time parameter "invalid" for BACKUP_AT/,
    );
  });

  it("emits z.iso.duration() for @type duration", () => {
    const res = generateEnv("# @type duration\nREQUEST_TIMEOUT=PT30S");
    expect(res).toMatch(/REQUEST_TIMEOUT: z\.iso\.duration\(\)/);
  });

  it("infers z.iso.duration() from ISO 8601 duration values", () => {
    expect(generateEnv("REQUEST_TIMEOUT=PT30S")).toMatch(/REQUEST_TIMEOUT: z\.iso\.duration\(\)/);
    expect(generateEnv("INTERVAL_DAY=P1D")).toMatch(/INTERVAL_DAY: z\.iso\.duration\(\)/);
    expect(generateEnv("TERM=P1Y2M")).toMatch(/TERM: z\.iso\.duration\(\)/);
  });

  it("does not infer time for plain 10:30", () => {
    expect(generateEnv("BACKUP_AT=10:30")).toMatch(/BACKUP_AT: z\.string\(\)/);
  });

  it("supports @minlength, @maxlength, and @pattern constraints", () => {
    const res = generateEnv("# @type time\n# @minlength 8\n# @maxlength 12\n# @pattern ^02:\nBACKUP_AT=02:30:00");
    expect(res).toMatch(/BACKUP_AT: z\.iso\.time\(\)\.min\(8\)\.max\(12\)\.regex\(\/\^02:\/\)/);
  });
});
