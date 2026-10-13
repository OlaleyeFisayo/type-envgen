import type { z } from "zod";
import { PREFIX } from "../constants/index.ts";

const FORMATS: Record<string, string> = {
  url: "URL",
  email: "email",
  uuid: "UUID",
  date: "date (YYYY-MM-DD)",
  datetime: "ISO datetime",
  ipv4: "IPv4 address",
  ipv6: "IPv6 address",
};

const UNITS: Record<string, string> = { string: " characters", array: " items" };

// Values are never included: env vars are often secrets and this message ends up in logs.
function describe(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "invalid_value":
      // z.stringbool() sets `expected` at runtime, but zod's issue type doesn't declare it.
      if ("expected" in issue && issue.expected === "stringbool") return "must be true or false";
      return `must be one of: ${issue.values.join(", ")}`;
    case "invalid_format":
      // The pattern comes from the user's own @pattern tag, so printing it is safe.
      if (issue.format === "regex" && "pattern" in issue) return `must match ${issue.pattern}`;
      return `must be a valid ${FORMATS[issue.format] ?? issue.format}`;
    case "invalid_type":
      if (issue.expected === "int") return "must be a whole number";
      return `must be a ${issue.expected}`;
    case "too_small":
      return `must be at least ${issue.minimum}${UNITS[issue.origin] ?? ""}`;
    case "too_big":
      return `must be at most ${issue.maximum}${UNITS[issue.origin] ?? ""}`;
    default:
      return issue.message;
  }
}

/** Parses `source` with `schema`, throwing one concise error that lists every bad variable. */
export function validateEnv<T extends z.ZodType>(schema: T, source: Record<string, unknown>): z.output<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const lines = new Map<string, string>();
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".");
    const top = String(issue.path[0]);
    // z.coerce.number() reports a missing key as NaN, so check the source instead of the issue.
    if (source[top] === undefined) lines.set(top, "missing");
    else if (!lines.has(key)) lines.set(key, describe(issue));
  }

  const message = `${PREFIX} Invalid environment variables:\n${[...lines].map(([k, m]) => `  ${k}: ${m}`).join("\n")}`;
  // node target (source is process.env): print just the list and exit, since Node's uncaught-error
  // output buries it under a stack trace. Framework targets throw so their error overlay shows it.
  const proc = (globalThis as { process?: NodeJS.Process }).process;
  if (proc && source === proc.env) {
    console.error(message);
    proc.exit(1);
  }
  throw new Error(message);
}
