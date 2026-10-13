import { TARGETS } from "../constants/index.ts";

// Regions owned by the generator; everything else in the file belongs to the user.
const IMPORT = /^import \{[^}]*\} from "type-envgen";$/m;
const SCHEMA = /^export const envSchema = z\.object\(\{$[\s\S]*?^\}\);$/m;
const ENV = /^export const env = [\s\S]*?\);$/m;
const ZOD_IMPORT = /^import \{ z \} from "zod";$/m;
// type-envgen <= 1.2 inlined this helper; it now clashes with the imported json.
const LEGACY_JSON = /^const json = <T extends z\.ZodType>\(schema: T\) =>[\s\S]*?\.pipe\(schema\);\n\n?/m;
const TARGET_IMPORTS = [...new Set(Object.values(TARGETS).flatMap((t) => t.imports))];

const region = (source: string, re: RegExp) => source.match(re)?.[0] ?? "";

/** Splices the generated regions of `generated` into an existing env module, keeping the user's own code. */
export function updateEnv(existing: string, generated: string, output: string): string {
  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  let file = existing.replace(/\r\n/g, "\n");
  for (const [re, label] of [
    [SCHEMA, "export const envSchema = z.object({"],
    [ENV, "export const env ="],
  ] as const) {
    if (!re.test(file)) {
      throw new Error(`Can't update ${output}: no "${label}" found. Delete the file to regenerate it.`);
    }
  }

  // Replacer functions, not strings: generated code can contain "$" (e.g. $env/dynamic/public).
  file = file
    .replace(LEGACY_JSON, "")
    .replace(SCHEMA, () => region(generated, SCHEMA))
    .replace(ENV, () => region(generated, ENV));
  const imports = [region(generated, IMPORT), ...TARGET_IMPORTS.filter((line) => generated.includes(line))];
  file = file
    .split("\n")
    .filter((line) => !TARGET_IMPORTS.includes(line) && !IMPORT.test(line))
    .join("\n");
  file = ZOD_IMPORT.test(file)
    ? file.replace(ZOD_IMPORT, (zod) => [zod, ...imports].join("\n"))
    : [...imports, file].join("\n");

  return file.replace(/\n/g, eol);
}
