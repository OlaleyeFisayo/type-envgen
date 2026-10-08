# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Full release notes for every version, including each merged pull request, are on
[GitHub Releases](https://github.com/OlaleyeFisayo/type-envgen/releases).

## [Unreleased]

### Added

- Support and automatic inference for date/datetime and IP formats: ISO dates (`z.iso.date()`), ISO datetimes (`z.iso.datetime()`), IPv4 addresses (`z.ipv4()`), and IPv6 addresses (`z.ipv6()`) (#2).
- Supported `@type` annotations: `date`, `datetime`, `ipv4`, and `ipv6`.
- `# @default <value>` tag that emits `.default(...)`. The value is validated against the variable's type (including `@min`/`@max`) at generation time, and combining it with `@optional` is an error (#1).

## [1.0.1] - 2026-10-07

### Fixed

- `bin` path in `package.json` normalized (npm was auto-correcting it at publish time).

### Security

- Releases are now published through npm Trusted Publishing (OIDC) with provenance; no long-lived npm token is used.
- Dev dependency `esbuild` forced to `^0.28.2` to resolve GHSA-g7r4-m6w7-qqqr (dev server only, never shipped in the package).

## [1.0.0] - 2026-10-07

First public release.

### Added

- `type-envgen` CLI: reads a `.env` file and writes a typed, zod-validated `env.ts`
  (`type-envgen [input] [-o output]`, plus `--help` and `--version`).
- Type inference from values: booleans, integers, floats, URLs, UUIDs, emails, typed JSON,
  and a `NODE_ENV` enum, with `string` as the fallback.
- `# @type` annotations to override inference: `string`, `number`, `int`, `boolean`, `url`,
  `email`, `uuid`, `json` and `enum(a, b, c)`.
- `# @min` / `# @max` tags: bounds on numbers, length limits on strings.
- `# @optional` tag for variables that may be missing.
- Clear errors for unknown tags or types, invalid bounds and unsupported combinations.
- Adds `zod@^4` to your project automatically if it's missing, using npm, pnpm, yarn or bun
  (`--skip-install` to opt out).

[Unreleased]: https://github.com/OlaleyeFisayo/type-envgen/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/OlaleyeFisayo/type-envgen/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/OlaleyeFisayo/type-envgen/releases/tag/v1.0.0
