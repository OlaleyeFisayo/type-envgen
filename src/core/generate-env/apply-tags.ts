import { z } from "zod";
import type { Tags } from "./read-tags.ts";

export type Bounds = {
  min?: number;
  max?: number;
  minTag?: "min" | "minlength";
  maxTag?: "max" | "maxlength";
};

const STRING_LIKE_REGEX =
  /^z\.(string|url|httpUrl|hostname|email|uuid|guid|nanoid|cuid|cuid2|ulid|ksuid|xid|iso\.date|iso\.datetime|iso\.time|iso\.duration|ipv4|ipv6|cidrv4|cidrv6|mac|e164|emoji|currencyCode|iban|creditCard|base64|base64url|hex|jwt|hash)\(/;
const NUMBER_REGEX = /^z\.coerce\.number\(/;

const NORMALIZE_FORMS = ["NFC", "NFD", "NFKC", "NFKD"];
const TEXT_CHECKS = { startswith: "startsWith", endswith: "endsWith", includes: "includes" } as const;
// zod issue format -> the tag that produced it, so generation errors can name the tag.
const TAG_BY_FORMAT: Record<string, string> = {
  starts_with: "startswith",
  ends_with: "endswith",
  includes: "includes",
  uppercase: "uppercase",
  lowercase: "lowercase",
};

// String checks (@length, @nonempty, @startswith, ...) and transforms (@trim, @tolowercase, ...).
// Returns the code to emit plus matching zod schemas to validate the .env value and @default now.
function stringTags(base: string, tags: Tags, key: string, isStringLike: boolean) {
  const supported = (tag: string, ok: boolean) => {
    if (!ok) throw new Error(`@${tag} is not supported for ${key} (${base})`);
  };
  // Transforms change the input before any check, so they also work on enums (e.g. @tolowercase).
  const canTransform = isStringLike || base.startsWith("z.enum(");
  let transforms = "";
  let full = z.string();
  if (tags.trim) {
    supported("trim", canTransform);
    transforms += ".trim()";
    full = full.trim();
  }
  if (tags.normalize !== undefined) {
    supported("normalize", canTransform);
    const form = tags.normalize.trim().toUpperCase();
    if (form && !NORMALIZE_FORMS.includes(form)) {
      throw new Error(`@normalize for ${key} must be one of ${NORMALIZE_FORMS.join(", ")}, got "${tags.normalize}"`);
    }
    transforms += form ? `.normalize(${JSON.stringify(form)})` : ".normalize()";
    full = full.normalize(form || undefined);
  }
  if (tags.tolowercase && tags.touppercase) throw new Error(`Cannot combine @tolowercase and @touppercase for ${key}`);
  if (tags.tolowercase) {
    supported("tolowercase", canTransform);
    transforms += ".toLowerCase()";
    full = full.toLowerCase();
  }
  if (tags.touppercase) {
    supported("touppercase", canTransform);
    transforms += ".toUpperCase()";
    full = full.toUpperCase();
  }

  let checks = "";
  let check = z.string();
  const add = (tag: string, code: string, apply: (s: z.ZodString) => z.ZodString) => {
    supported(tag, isStringLike);
    checks += code;
    check = apply(check);
    full = apply(full);
  };
  if (tags.length !== undefined) {
    const n = parseBound(tags.length, "length", key, true);
    add("length", `.length(${n})`, (s) => s.length(n));
  }
  if (tags.nonempty) add("nonempty", ".nonempty()", (s) => s.nonempty());
  for (const [tag, method] of Object.entries(TEXT_CHECKS) as [keyof typeof TEXT_CHECKS, string][]) {
    const raw = tags[tag];
    if (raw === undefined) continue;
    const text = unquote(raw.trim());
    if (!text) throw new Error(`@${tag} for ${key} requires a value`);
    add(tag, `.${method}(${JSON.stringify(text)})`, (s) => s[TEXT_CHECKS[tag]](text));
  }
  if (tags.uppercase) add("uppercase", ".uppercase()", (s) => s.uppercase());
  if (tags.lowercase) add("lowercase", ".lowercase()", (s) => s.lowercase());

  return { transforms, checks, check, full };
}

// Names the tag behind the first failing issue of a stringTags schema.
function failedTag(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue.code === "invalid_format") return TAG_BY_FORMAT[issue.format] ?? issue.format;
  return "exact" in issue && issue.exact ? "length" : "nonempty";
}

function parseBound(
  raw: string,
  tag: "min" | "max" | "minlength" | "maxlength" | "length",
  key: string,
  isStringLike: boolean,
): number {
  if (isStringLike) {
    const trimmed = raw.trim();
    const n = Number(trimmed);
    if (!trimmed || !/^\d+$/.test(trimmed) || !Number.isSafeInteger(n) || n < 0) {
      throw new Error(`@${tag} for ${key} must be a non-negative integer, got "${raw}"`);
    }
    return n;
  }
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) {
    throw new Error(`@${tag} for ${key} must be a number, got "${raw}"`);
  }
  return n;
}

export function applyTags(base: string, tags: Tags, key: string, value = ""): string {
  if (tags.unknown) throw new Error(`Unknown tag @${tags.unknown} for ${key}`);
  if (tags.default !== undefined && tags.optional) {
    throw new Error(`Cannot combine @default and @optional for ${key}`);
  }

  const isStringLike = STRING_LIKE_REGEX.test(base);
  const isNumber = NUMBER_REGEX.test(base);

  if (tags.min !== undefined && tags.minlength !== undefined) {
    throw new Error(`Cannot combine @min and @minlength for ${key}`);
  }
  if (tags.max !== undefined && tags.maxlength !== undefined) {
    throw new Error(`Cannot combine @max and @maxlength for ${key}`);
  }

  if (tags.minlength !== undefined && !isStringLike) {
    throw new Error(`@minlength is not supported for ${key} (${base})`);
  }
  if (tags.maxlength !== undefined && !isStringLike) {
    throw new Error(`@maxlength is not supported for ${key} (${base})`);
  }
  if (tags.min !== undefined && !isNumber && !isStringLike) {
    throw new Error(`@min is not supported for ${key} (${base})`);
  }
  if (tags.max !== undefined && !isNumber && !isStringLike) {
    throw new Error(`@max is not supported for ${key} (${base})`);
  }

  const bounds: Bounds = {};

  const minRaw = tags.minlength ?? tags.min;
  const minTag = tags.minlength !== undefined ? "minlength" : "min";
  if (minRaw !== undefined) {
    bounds.min = parseBound(minRaw, minTag, key, isStringLike);
    bounds.minTag = minTag;
  }

  const maxRaw = tags.maxlength ?? tags.max;
  const maxTag = tags.maxlength !== undefined ? "maxlength" : "max";
  if (maxRaw !== undefined) {
    bounds.max = parseBound(maxRaw, maxTag, key, isStringLike);
    bounds.maxTag = maxTag;
  }

  if (bounds.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max) {
    throw new Error(`@${bounds.minTag} (${bounds.min}) is greater than @${bounds.maxTag} (${bounds.max}) for ${key}`);
  }

  let schema = base;
  if (bounds.min !== undefined) {
    schema += `.min(${bounds.min})`;
  }
  if (bounds.max !== undefined) {
    schema += `.max(${bounds.max})`;
  }

  const strings = stringTags(base, tags, key, isStringLike);
  schema += strings.checks;
  if (strings.checks) {
    // Like @pattern: catch a bad value or @default now. The value isn't echoed: it may be a secret.
    const result = strings.full.safeParse(value);
    if (!result.success) throw new Error(`Value of ${key} does not satisfy @${failedTag(result.error)}`);
    if (tags.default !== undefined) {
      // .default() skips transforms and checks at runtime, so the default must pass the checks as written.
      const def = strings.check.safeParse(unquote(tags.default.trim()));
      if (!def.success) throw new Error(`@default for ${key} does not satisfy @${failedTag(def.error)}`);
    }
  }

  if (tags.pattern !== undefined) {
    if (!isStringLike) {
      throw new Error(`@pattern is not supported for ${key} (${base})`);
    }
    const raw = unquote(tags.pattern.trim());
    let regex: RegExp;
    try {
      if (!raw) throw new Error("pattern cannot be empty");
      const match = raw.match(/^\/(.+)\/([a-zA-Z]*)$/);
      // g and y make RegExp.test stateful (lastIndex), so the same value would alternately pass and fail.
      if (match && /[gy]/.test(match[2])) throw new Error("flags g and y are not supported");
      regex = match ? new RegExp(match[1], match[2]) : new RegExp(raw);
    } catch (err) {
      throw new Error(`Invalid regex for ${key}: ${(err as Error).message}`);
    }
    // The value isn't echoed: it comes from .env and may be a secret.
    if (!regex.test(value)) throw new Error(`Value of ${key} does not match @pattern`);
    if (tags.default !== undefined && !regex.test(unquote(tags.default.trim()))) {
      throw new Error(`@default for ${key} does not match @pattern`);
    }
    schema += `.regex(${regex.toString()})`;
  }

  // Transforms must run before every check, including a format's own (z.email().trim() would
  // reject " a@b.com " before trimming), so anything but a plain string is piped through them.
  if (strings.transforms) {
    schema =
      base === "z.string()"
        ? `z.string()${strings.transforms}${schema.slice(base.length)}`
        : `z.string()${strings.transforms}.pipe(${schema})`;
  }

  if (tags.default !== undefined) {
    schema += formatDefault(base, tags.default, key, bounds);
  }

  return tags.optional ? `${schema}.optional()` : schema;
}

// Strips one pair of matching surrounding quotes, so tag values can be written as "x" or 'x'.
const unquote = (s: string) => (s.length >= 2 && /^(["']).*\1$/s.test(s) ? s.slice(1, -1) : s);

const FORMATS: [string, z.ZodType, string][] = [
  ["z.httpUrl()", z.httpUrl(), "HTTP URL"],
  ["z.hostname()", z.hostname(), "hostname"],
  ["z.nanoid()", z.nanoid(), "nanoid"],
  ["z.cuid()", z.cuid(), "cuid"],
  ["z.cuid2()", z.cuid2(), "cuid2"],
  ["z.ulid()", z.ulid(), "ULID"],
  ["z.ksuid()", z.ksuid(), "KSUID"],
  ["z.xid()", z.xid(), "XID"],
  ["z.iso.date()", z.iso.date(), "ISO date"],
  ["z.iso.time()", z.iso.time(), "ISO time"],
  ["z.iso.duration()", z.iso.duration(), "ISO duration"],
  ["z.ipv4()", z.ipv4(), "IPv4 address"],
  ["z.ipv6()", z.ipv6(), "IPv6 address"],
  ["z.e164()", z.e164(), "E.164 number"],
  ["z.emoji()", z.emoji(), "emoji"],
  ["z.currencyCode()", z.currencyCode(), "currency code"],
  ["z.iban()", z.iban(), "IBAN"],
  ["z.creditCard()", z.creditCard(), "credit card number"],
  ["z.base64()", z.base64(), "base64 string"],
  ["z.base64url()", z.base64url(), "base64url string"],
  ["z.hex()", z.hex(), "hex string"],
  ["z.cidrv4()", z.cidrv4(), "IPv4 CIDR block"],
  ["z.cidrv6()", z.cidrv6(), "IPv6 CIDR block"],
  ["z.guid()", z.guid(), "GUID"],
];

function checkStringBounds(raw: string, bounds: Bounds, key: string) {
  if (bounds.min !== undefined && raw.length < bounds.min) {
    throw new Error(
      `@default length (${raw.length}) is less than @${bounds.minTag ?? "min"} (${bounds.min}) for ${key}`,
    );
  }
  if (bounds.max !== undefined && raw.length > bounds.max) {
    throw new Error(
      `@default length (${raw.length}) is greater than @${bounds.maxTag ?? "max"} (${bounds.max}) for ${key}`,
    );
  }
}

function formatDefault(base: string, rawInput: string, key: string, bounds: Bounds): string {
  if (!rawInput.trim() && rawInput === "") {
    throw new Error(`@default for ${key} requires a value`);
  }

  const raw = unquote(rawInput.trim());

  // Integer
  if (base.includes("z.coerce.number().int()")) {
    const n = Number(raw);
    if (!raw || !Number.isInteger(n)) {
      throw new Error(`@default for ${key} must be an integer, got "${rawInput}"`);
    }
    if (bounds.min !== undefined && n < bounds.min) {
      throw new Error(`@default (${n}) is less than @min (${bounds.min}) for ${key}`);
    }
    if (bounds.max !== undefined && n > bounds.max) {
      throw new Error(`@default (${n}) is greater than @max (${bounds.max}) for ${key}`);
    }
    return `.default(${n})`;
  }

  // Float/number
  if (base.includes("z.coerce.number()")) {
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) {
      throw new Error(`@default for ${key} must be a number, got "${rawInput}"`);
    }
    if (bounds.min !== undefined && n < bounds.min) {
      throw new Error(`@default (${n}) is less than @min (${bounds.min}) for ${key}`);
    }
    if (bounds.max !== undefined && n > bounds.max) {
      throw new Error(`@default (${n}) is greater than @max (${bounds.max}) for ${key}`);
    }
    return `.default(${n})`;
  }

  // Boolean
  if (base.includes("z.stringbool()")) {
    if (/^(true|1)$/i.test(raw)) return ".default(true)";
    if (/^(false|0)$/i.test(raw)) return ".default(false)";
    throw new Error(`@default for ${key} must be a boolean (true/false/1/0), got "${rawInput}"`);
  }

  // URL
  if (base.includes("z.url()")) {
    if (!z.url().safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid URL, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Email with preset
  const emailPresetMatch = base.match(/^z\.email\(\{\s*pattern:\s*z\.regexes\.([a-zA-Z0-9]+)\s*\}\)/);
  if (emailPresetMatch) {
    const regexKey = emailPresetMatch[1] as keyof typeof z.regexes;
    const pattern = z.regexes[regexKey];
    if (!pattern || !z.email({ pattern: pattern as RegExp }).safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid email, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Email
  if (base.includes("z.email()")) {
    if (!z.email().safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid email, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // UUID
  if (base.startsWith("z.uuid(")) {
    // version was validated in annotatedSchema, so the cast is safe.
    const version = base.match(/version:\s*"([^"]+)"/)?.[1] as never;
    const schema = version ? z.uuid({ version }) : z.uuid();
    if (!schema.safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid UUID, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // MAC with optional delimiter
  const macMatch = base.match(/^z\.mac\((.*?)\)/);
  if (macMatch) {
    const opts = macMatch[1].trim();
    const delimMatch = opts.match(/delimiter:\s*"([^"]+)"/);
    const schema = delimMatch ? z.mac({ delimiter: delimMatch[1] }) : z.mac();
    if (!schema.safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid MAC address, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Time with precision
  const timePrecisionMatch = base.match(/^z\.iso\.time\(\{\s*precision:\s*(\d+)\s*\}\)/);
  if (timePrecisionMatch) {
    const prec = Number.parseInt(timePrecisionMatch[1], 10);
    if (!z.iso.time({ precision: prec }).safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid ISO time, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Datetime (supports options: offset, local, precision)
  if (base.startsWith("z.iso.datetime(")) {
    let schema = z.iso.datetime();
    const optsMatch = base.match(/^z\.iso\.datetime\((\{.*?\})\)/);
    if (optsMatch) {
      const optsObj: { offset?: boolean; local?: boolean; precision?: number } = {};
      if (optsMatch[1].includes("offset: true")) optsObj.offset = true;
      if (optsMatch[1].includes("local: true")) optsObj.local = true;
      const precMatch = optsMatch[1].match(/precision:\s*(\d+)/);
      if (precMatch) optsObj.precision = Number(precMatch[1]);
      schema = z.iso.datetime(optsObj);
    }
    if (!schema.safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid ISO datetime, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Date / time / duration / IP / CIDR / other plain formats
  const format = FORMATS.find(([prefix]) => base.startsWith(prefix));
  if (format) {
    const [, schema, label] = format;
    if (!schema.safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid ${label}, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // JWT
  if (base.startsWith("z.jwt(")) {
    // alg was validated in annotatedSchema, so the cast is safe.
    const alg = base.match(/alg:\s*"([^"]+)"/)?.[1] as never;
    const schema = alg ? z.jwt({ alg }) : z.jwt();
    if (!schema.safeParse(raw).success) {
      throw new Error(`@default for ${key} must be a valid JWT, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Hash
  if (base.startsWith("z.hash(")) {
    // alg and enc were validated in annotatedSchema, so the casts are safe.
    const alg = base.match(/z\.hash\("([^"]+)"/)?.[1] as never;
    const enc = base.match(/enc:\s*"([^"]+)"/)?.[1] as never;
    const schema = enc ? z.hash(alg, { enc }) : z.hash(alg);
    if (!schema.safeParse(raw).success) {
      const label = enc && enc !== "hex" ? `${alg} hash (${enc})` : `${alg} hash`;
      throw new Error(`@default for ${key} must be a valid ${label}, got "${rawInput}"`);
    }
    checkStringBounds(raw, bounds, key);
    return `.default(${JSON.stringify(raw)})`;
  }

  // Enum
  const enumMatch = base.match(/^z\.enum\((\[.*?\])\)/);
  if (enumMatch) {
    const allowed: string[] = JSON.parse(enumMatch[1]);
    if (!allowed.includes(raw)) {
      throw new Error(`@default "${raw}" for ${key} is not in enum (${allowed.join(", ")})`);
    }
    return `.default(${JSON.stringify(raw)})`;
  }

  // JSON
  if (base.startsWith("json(")) {
    try {
      JSON.parse(raw);
    } catch {
      throw new Error(`@default for ${key} must be valid JSON, got "${rawInput}"`);
    }
    return `.default(${raw})`;
  }

  // Default string
  checkStringBounds(raw, bounds, key);
  return `.default(${JSON.stringify(raw)})`;
}
