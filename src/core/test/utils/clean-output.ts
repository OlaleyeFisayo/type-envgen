import { rmSync } from "node:fs";
import { join } from "node:path";

// Vitest global setup: runs once before all spec files, so parallel specs never delete each other's output.
export default () => rmSync(join(import.meta.dirname, "..", "output"), { recursive: true, force: true });
