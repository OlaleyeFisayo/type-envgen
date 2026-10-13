// Public API: what generated env modules (and users) import from "type-envgen".
// .js on purpose: tsc copies the specifier verbatim into dist/index.d.ts, where .ts would not resolve.
export { json } from "./core/generate-env/json.js";
export { validateEnv } from "./core/generate-env/validate-env.js";
