import { describe, expect, it } from "vitest";
import { generateEnv } from "../../generate-env/index.ts";

// The schema line generated for key X.
const field = (env: string) =>
  generateEnv(env)
    .split("\n")
    .find((l) => l.startsWith("  X: "))
    ?.slice("  X: ".length);

describe("string checks", () => {
  it.each([
    ["@length 3", "abc", "z.string().length(3),"],
    ["@nonempty", "abc", "z.string().nonempty(),"],
    ["@startswith sk_", "sk_1", 'z.string().startsWith("sk_"),'],
    ["@endswith .com", "a.com", 'z.string().endsWith(".com"),'],
    ["@includes @", "a@b", 'z.string().includes("@"),'],
    ["@uppercase", "ABC", "z.string().uppercase(),"],
    ["@lowercase", "abc", "z.string().lowercase(),"],
  ])("%s", (tag, value, expected) => {
    expect(field(`# ${tag}\nX=${value}`)).toBe(expected);
  });

  it("works on string formats", () => {
    expect(field("# @type email\n# @endswith @acme.com\nX=a@acme.com")).toBe('z.email().endsWith("@acme.com"),');
  });

  it("accepts quoted text and any tag casing", () => {
    expect(field('# @startsWith "sk_ "\nX="sk_ 1"')).toBe('z.string().startsWith("sk_ "),');
    expect(field("# @LENGTH 1\nX=a")).toBe("z.string().length(1),");
  });

  it("checks the .env value and @default at generation time", () => {
    expect(() => generateEnv("# @startswith sk_\nX=pk_1")).toThrow(/Value of X does not satisfy @startswith/);
    expect(() => generateEnv("# @length 3\nX=ab")).toThrow(/Value of X does not satisfy @length/);
    expect(() => generateEnv("# @length 3\n# @default abcd\nX=abc")).toThrow(/@default for X does not satisfy @length/);
  });

  it("never echoes the value", () => {
    expect(() => generateEnv("# @startswith sk_\nX=hunter2")).toThrow(/^(?!.*hunter2)/);
  });

  it.each([
    ["@length 3", "X=1", /@length is not supported for X/],
    ["@uppercase", "X=true", /@uppercase is not supported for X/],
    ["@startswith", "X=a", /@startswith for X requires a value/],
    ["@length -1", "X=a", /@length for X must be a non-negative integer/],
  ])("rejects %s on %s", (tag, line, message) => {
    expect(() => generateEnv(`# ${tag}\n${line}`)).toThrow(message);
  });
});

describe("string transforms", () => {
  it("runs transforms before checks on plain strings", () => {
    expect(field("# @trim\n# @tolowercase\n# @startswith sk_\n# @length 6\nX=SK_ABC")).toBe(
      'z.string().trim().toLowerCase().length(6).startsWith("sk_"),',
    );
  });

  it("pipes formats and enums through the transforms", () => {
    expect(field("# @trim\n# @type email\nX=a@b.com")).toBe("z.string().trim().pipe(z.email()),");
    expect(field("# @tolowercase\n# @type enum(debug, info)\nX=INFO")).toBe(
      'z.string().toLowerCase().pipe(z.enum(["debug","info"])),',
    );
  });

  it("supports @touppercase and @normalize forms", () => {
    expect(field("# @touppercase\nX=a")).toBe("z.string().toUpperCase(),");
    expect(field("# @normalize\nX=a")).toBe("z.string().normalize(),");
    expect(field("# @normalize nfkd\nX=a")).toBe('z.string().normalize("NFKD"),');
  });

  it("validates the transformed value", () => {
    expect(field("# @tolowercase\n# @lowercase\nX=ABC")).toBe("z.string().toLowerCase().lowercase(),");
  });

  it.each([
    ["@trim", "X=1", /@trim is not supported for X/],
    ["@normalize xyz", "X=a", /@normalize for X must be one of NFC, NFD, NFKC, NFKD/],
    ["@tolowercase\n# @touppercase", "X=a", /Cannot combine @tolowercase and @touppercase for X/],
  ])("rejects %s", (tag, line, message) => {
    expect(() => generateEnv(`# ${tag}\n${line}`)).toThrow(message);
  });
});
