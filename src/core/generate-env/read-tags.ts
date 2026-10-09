export type Tags = {
  type?: string;
  optional?: boolean;
  default?: string;
  min?: string;
  max?: string;
  pattern?: string;
  unknown?: string;
};

// parseEnv drops comments, so "# @tag" lines are read with a separate line scan.
// Tags apply to the next key line; a blank line in between cancels them.
// Raw text only: validation happens per key so errors can name it.
export function readTags(envSource: string): Map<string, Tags> {
  const tagsByKey = new Map<string, Tags>();
  let pending: Tags = {};
  for (const line of envSource.split(/\r?\n/)) {
    const tag = line.match(/^\s*#\s*@(\w+)(?:\s+(.+?))?\s*$/);
    if (tag) {
      const [, name, arg = ""] = tag;
      if (name === "type" || name === "min" || name === "max" || name === "default" || name === "pattern") {
        pending[name] = arg;
      } else if (name === "optional") pending[name] = true;
      else pending.unknown = name;
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
