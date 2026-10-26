// Tags that take an argument (`# @name <arg>`).
const VALUE_TAGS = [
  "type",
  "min",
  "max",
  "minlength",
  "maxlength",
  "length",
  "pattern",
  "startswith",
  "endswith",
  "includes",
  "normalize",
  "default",
] as const;
// Tags that are switches (`# @name`).
const FLAG_TAGS = ["optional", "nonempty", "uppercase", "lowercase", "trim", "tolowercase", "touppercase"] as const;

export type Tags = Partial<Record<(typeof VALUE_TAGS)[number], string>> &
  Partial<Record<(typeof FLAG_TAGS)[number], boolean>> & { unknown?: string };

const isValueTag = (name: string): name is (typeof VALUE_TAGS)[number] =>
  (VALUE_TAGS as readonly string[]).includes(name);
const isFlagTag = (name: string): name is (typeof FLAG_TAGS)[number] => (FLAG_TAGS as readonly string[]).includes(name);

// parseEnv drops comments, so "# @tag" lines are read with a separate line scan.
// Tags apply to the next key line; a blank line in between cancels them.
// Raw text only: validation happens per key so errors can name it.
export function readTags(envSource: string): Map<string, Tags> {
  const tagsByKey = new Map<string, Tags>();
  let pending: Tags = {};
  for (const line of envSource.split(/\r?\n/)) {
    const tag = line.match(/^\s*#\s*@(\w+)(?:\s+(.+?))?\s*$/);
    if (tag) {
      const [, rawName, arg = ""] = tag;
      // Tag names are case-insensitive: @startsWith and @startswith are the same tag.
      const name = rawName.toLowerCase();
      if (isValueTag(name)) pending[name] = arg;
      else if (isFlagTag(name)) pending[name] = true;
      else pending.unknown = rawName;
    } else if (!line.trim()) pending = {};
    else {
      const key = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=/)?.[1];
      if (key) {
        tagsByKey.set(key, pending);
        pending = {};
      }
    }
  }
  return tagsByKey;
}
