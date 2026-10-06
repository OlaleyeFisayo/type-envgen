import { prop } from "./prop.ts";

export function jsonSchema(value: unknown): string {
  if (value === null) return "z.null()";
  if (Array.isArray(value)) {
    const items = [...new Set(value.map(jsonSchema))];
    if (items.length === 0) return "z.array(z.unknown())";
    return `z.array(${items.length === 1 ? items[0] : `z.union([${items.join(", ")}])`})`;
  }
  if (typeof value === "object") {
    const fields = Object.entries(value).map(([k, v]) => `${prop(k)}: ${jsonSchema(v)}`);
    return `z.object({ ${fields.join(", ")} })`;
  }
  return `z.${typeof value}()`; // string | number | boolean
}
