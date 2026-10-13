import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";

describe("@type email(<preset>)", () => {
  it.each([
    ["html5", "html5Email"],
    ["rfc5322", "rfc5322Email"],
    ["unicode", "unicodeEmail"],
    ["browser", "browserEmail"],
  ])("maps %s to z.regexes.%s", (preset, regexName) => {
    const res = generateEnv(`# @type email(${preset})\nCONTACT_EMAIL=user@example.com`);
    expect(res).toMatch(new RegExp(`CONTACT_EMAIL: z\\.email\\(\\{ pattern: z\\.regexes\\.${regexName} \\}\\)`));
  });

  it("is case-insensitive", () => {
    expect(generateEnv("# @type EMAIL(HTML5)\nCONTACT_EMAIL=user@example.com")).toMatch(
      /CONTACT_EMAIL: z\.email\(\{ pattern: z\.regexes\.html5Email \}\)/,
    );
    expect(generateEnv("# @type email(UNICODE)\nCONTACT_EMAIL=user@üñîçødé.com")).toMatch(
      /CONTACT_EMAIL: z\.email\(\{ pattern: z\.regexes\.unicodeEmail \}\)/,
    );
  });

  it("rejects unknown presets naming the key and listing valid presets", () => {
    expect(() => generateEnv("# @type email(foo)\nCONTACT_EMAIL=user@example.com")).toThrow(
      /Invalid email preset "foo" for CONTACT_EMAIL \(expected one of: html5, rfc5322, unicode, browser\)/,
    );
  });

  it("leaves plain @type email unchanged", () => {
    expect(generateEnv("# @type email\nCONTACT_EMAIL=user@example.com")).toMatch(/CONTACT_EMAIL: z\.email\(\)/);
  });

  it("validates @default using the same preset", () => {
    // Unicode default passes with unicode preset
    expect(
      generateEnv("# @type email(unicode)\n# @default support@üñîçødé.com\nCONTACT_EMAIL=admin@üñîçødé.com"),
    ).toMatch(/CONTACT_EMAIL: z\.email\(\{ pattern: z\.regexes\.unicodeEmail \}\)\.default\("support@üñîçødé\.com"\)/);

    // Unicode default fails with html5 preset
    expect(() =>
      generateEnv("# @type email(html5)\n# @default support@üñîçødé.com\nCONTACT_EMAIL=admin@example.com"),
    ).toThrow(/@default for CONTACT_EMAIL must be a valid email/);
  });

  it("supports @minlength, @maxlength, and @pattern constraints", () => {
    const res = generateEnv(
      "# @type email(html5)\n# @minlength 5\n# @maxlength 50\n# @pattern ^[a-z]+@\nCONTACT_EMAIL=test@example.com",
    );
    expect(res).toMatch(
      /CONTACT_EMAIL: z\.email\(\{ pattern: z\.regexes\.html5Email \}\)\.min\(5\)\.max\(50\)\.regex\(\/\^\[a-z\]\+@\/\)/,
    );
  });
});
