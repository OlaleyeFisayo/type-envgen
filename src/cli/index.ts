#!/usr/bin/env node
import pkg from "../../package.json" with { type: "json" };
import { PREFIX } from "../core/constants/index.ts";
import { readArgs } from "./args.ts";
import { check } from "./check.ts";
import { ensureDeps } from "./ensure-deps.ts";
import { fail } from "./fail.ts";
import { generate } from "./generate.ts";
import { HELP } from "./help.ts";
import { init } from "./init.ts";
import { watchEnv } from "./watch.ts";

const { values, positionals, target } = readArgs();
const input = positionals[0] ?? ".env";

if (values.help) {
  console.log(HELP);
} else if (values.version) {
  console.log(`${PREFIX} ${pkg.version}`);
} else if (positionals[0] === "init") {
  await init((input, output, t) => {
    generate(input, output, t);
    ensureDeps(false);
  });
} else if (values.check) {
  // Never writes files or installs dependencies.
  try {
    check(input, values.output, target);
  } catch (err) {
    fail((err as Error).message);
  }
} else if (values.watch) {
  watchEnv(input, values.output, target, values["skip-install"] ?? false);
} else {
  try {
    generate(input, values.output, target);
  } catch (err) {
    fail((err as Error).message);
  }

  ensureDeps(values["skip-install"] ?? false);
}
