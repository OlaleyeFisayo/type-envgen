import { parseArgs } from "node:util";
import { TARGETS, type TargetName } from "../core/constants/index.ts";
import { fail } from "./fail.ts";

/** Parses and validates the command line. Exits with a message on bad input. */
export function readArgs() {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse();
  } catch (err) {
    fail(`${(err as Error).message}\nRun type-envgen --help for usage.`);
  }

  const { values, positionals } = parsed;
  const target = values.target as string;
  if (!(target in TARGETS)) fail(`Unknown target "${target}". Choose one of: ${Object.keys(TARGETS).join(", ")}`);
  if (values.check && values.watch) fail("--check and --watch can't be used together");

  return { values, positionals, target: target as TargetName };
}

function parse() {
  return parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o", default: "env.ts" },
      target: { type: "string", default: "node" },
      check: { type: "boolean" },
      watch: { type: "boolean", short: "w" },
      "skip-install": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
}
