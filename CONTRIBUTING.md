# Contributing to type-envgen

Thanks for wanting to help! Bug reports, ideas, docs fixes and pull requests are all welcome.
By taking part you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before you start

- **Bugs:** [open a bug report](https://github.com/OlaleyeFisayo/type-envgen/issues/new/choose) with a minimal `.env` that reproduces it.
- **Features and larger changes:** open a feature request first so we can agree on the approach before you write code.
- **Security issues:** don't open a public issue — see [SECURITY.md](./SECURITY.md).
- **Questions and ideas:** ask in [Discussions](https://github.com/OlaleyeFisayo/type-envgen/discussions).
- **Looking for something to work on?** Check issues labelled [`good first issue`](https://github.com/OlaleyeFisayo/type-envgen/labels/good%20first%20issue) or [`help wanted`](https://github.com/OlaleyeFisayo/type-envgen/labels/help%20wanted). Comment on the issue so others know you're on it.

## Setup

Requires Node.js 22 or newer for development (the test script runs TypeScript directly).

```sh
git clone https://github.com/OlaleyeFisayo/type-envgen.git
cd type-envgen
npm install         # also installs the git hooks
```

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm test`          | Builds, then runs the generator and CLI checks       |
| `npm run typecheck` | Type-checks the project                              |
| `npm run lint`      | Biome: lint + formatting check                       |
| `npm run format`    | Biome: auto-fix lint and formatting                  |
| `npm run build`     | Builds `dist/cli.js` with tsup                       |

## Project layout

```
src/
  cli.ts                 # CLI: argument parsing, help, read -> generate -> write, zod install
  core/
    generate-env/        # generator, one function per file (index.ts exports generateEnv)
    test/                # sample .env and the test script
docs/                    # maintainer docs (releasing)
```

To add a type or tag: update `src/core/generate-env/`, add a case to `src/core/test/.env`, add an assertion in `src/core/test/run.ts`, and document it in the README and the `--help` text in `src/cli.ts`.

## Git hooks

[Husky](https://typicode.github.io/husky/) hooks run automatically:

| Hook         | What it does                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `pre-commit` | Formats and lints staged files with [Biome](https://biomejs.dev) (auto-fixing what it can), then typechecks |
| `commit-msg` | Checks the message follows [Conventional Commits](https://www.conventionalcommits.org)          |
| `pre-push`   | Runs `lint`, `typecheck` and `test:gen`                                                         |

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org): `type: short description`, lower case, no trailing period.

```
feat: add @default tag
fix: handle quoted values with # inside
docs: clarify @min on strings
refactor: split tag parsing into its own file
chore: bump dependencies
```

| Type       | Use for                                   |
| ---------- | ----------------------------------------- |
| `feat`     | A new feature                             |
| `fix`      | A bug fix                                 |
| `docs`     | Documentation only                        |
| `refactor` | Code change that isn't a fix or feature   |
| `perf`     | Performance improvement                   |
| `test`     | Adding or fixing tests                    |
| `style`    | Formatting only                           |
| `ci`       | GitHub Actions / tooling                  |
| `chore`    | Everything else (deps, config, releases)  |

Breaking changes get a `!`: `feat!: rename --output to --out`.

## Pull requests

`main` is protected: all changes land through pull requests that the maintainer reviews and merges.

1. Fork the repo and create a branch from `main` (`fix/quoted-hash`, `feat/default-tag`).
2. Keep the PR focused on **one** change. Unrelated cleanups go in their own PR.
3. Add or update tests in `src/core/test/` for any behavior change.
4. Update the README and `--help` if user-facing behavior changes.
5. For user-facing changes, add a line under `## [Unreleased]` in [CHANGELOG.md](./CHANGELOG.md) (`Added`, `Changed`, `Fixed` or `Removed`).
6. Make sure `npm run lint`, `npm run typecheck` and `npm test` pass.
7. Give the PR a **Conventional Commit title** — PRs are squash-merged and the title becomes the commit message. A check on the PR verifies it.
8. Fill in the PR template: what changed, why, and how you tested it.

CI runs lint, typecheck and tests on Node 22 and 24 on Linux, the tests on Windows, and a Node 20 smoke test. All checks, including the PR title check, must pass before a PR can be merged.

Don't bump the version in your PR — releases are handled by the maintainer (see [docs/releasing.md](./docs/releasing.md)).
