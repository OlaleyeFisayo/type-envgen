import { PREFIX } from "../core/constants/index.ts";

export function fail(message: string): never {
  console.error(`${PREFIX} ${message}`);
  process.exit(1);
}
