import { TYPES } from "../constants/index.ts";
import { jsonSchema } from "./json-schema.ts";

const JWT_ALGS = new Set([
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
  "PS256",
  "PS384",
  "PS512",
  "EdDSA",
]);

const HASH_ALGS = new Set(["md5", "sha1", "sha256", "sha384", "sha512"]);
const HASH_ENCS = new Set(["hex", "base64", "base64url"]);

export function annotatedSchema(type: string, key: string, value: string): string {
  const enumValues = type.match(/^enum\((.*)\)$/i)?.[1];
  if (enumValues !== undefined) {
    const values = enumValues
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length) return `z.enum(${JSON.stringify(values)})`;
  }
  const jwtAlg = type.match(/^jwt\((.*)\)$/i)?.[1];
  if (jwtAlg !== undefined) {
    const rawAlg = jwtAlg.trim();
    const canonicalAlg = [...JWT_ALGS].find((a) => a.toLowerCase() === rawAlg.toLowerCase());
    if (!canonicalAlg) {
      throw new Error(`Unknown JWT algorithm "${rawAlg}" for ${key}`);
    }
    return `z.jwt({ alg: "${canonicalAlg}" })`;
  }
  const hashMatch = type.match(/^hash\((.*)\)$/i);
  if (hashMatch) {
    const parts = hashMatch[1]
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      throw new Error(`@type hash requires an algorithm parameter for ${key}`);
    }
    if (parts.length > 2) {
      throw new Error(`Too many parameters for @type hash in ${key}`);
    }
    const [rawAlg, rawEnc] = parts;
    const alg = rawAlg.toLowerCase();
    if (!HASH_ALGS.has(alg)) {
      throw new Error(`Unknown hash algorithm "${rawAlg}" for ${key}`);
    }
    if (rawEnc !== undefined) {
      const enc = rawEnc.toLowerCase();
      if (!HASH_ENCS.has(enc)) {
        throw new Error(`Unknown hash encoding "${rawEnc}" for ${key}`);
      }
      if (enc === "hex") return `z.hash("${alg}")`;
      return `z.hash("${alg}", { enc: "${enc}" })`;
    }
    return `z.hash("${alg}")`;
  }
  const macDelimiter = type.match(/^mac\((.*)\)$/i)?.[1]?.trim();
  if (macDelimiter !== undefined) {
    if (![":", "-", "."].includes(macDelimiter)) throw new Error(`Unknown MAC delimiter "${macDelimiter}" for ${key}`);
    return `z.mac({ delimiter: ${JSON.stringify(macDelimiter)} })`;
  }
  const name = type.toLowerCase();
  if (name === "hash") {
    throw new Error(`@type hash requires an algorithm parameter for ${key}`);
  }
  if (name in TYPES) return TYPES[name];
  if (name === "json") {
    try {
      return `json(${jsonSchema(JSON.parse(value))})`;
    } catch {
      return "json(z.unknown())";
    }
  }
  throw new Error(`Unknown @type "${type}" for ${key}`);
}
