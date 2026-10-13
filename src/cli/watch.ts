import { existsSync, watch } from "node:fs";
import { PREFIX, type TargetName } from "../core/constants/index.ts";
import { ensureDeps } from "./ensure-deps.ts";
import { fail } from "./fail.ts";
import { generate } from "./generate.ts";

/** Regenerates the output whenever the input file changes, until the process is stopped. */
export function watchEnv(input: string, output: string, target: TargetName, skipInstall: boolean) {
  if (!existsSync(input)) fail(`Input file not found: ${input}`);

  function runGenerate() {
    try {
      generate(input, output, target);
    } catch (err) {
      console.error(`${PREFIX} ${(err as Error).message}`);
    }
  }

  runGenerate();
  ensureDeps(skipInstall);

  let watcher: ReturnType<typeof watch> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function startWatching() {
    try {
      watcher = watch(input, (eventType) => {
        if (eventType === "rename") {
          watcher?.close();
          setTimeout(startWatching, 50);
        }
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runGenerate, 150);
      });
      watcher.on("error", () => {
        watcher?.close();
        setTimeout(startWatching, 100);
      });
    } catch {
      setTimeout(startWatching, 100);
    }
  }

  startWatching();

  const cleanup = () => {
    watcher?.close();
    clearTimeout(debounceTimer);
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
