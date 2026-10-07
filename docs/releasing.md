# Releasing type-envgen

How to publish a new version to [npm](https://www.npmjs.com/package/type-envgen). Releases are automated: you bump the version with one command, and GitHub Actions publishes it.

## TL;DR

```sh
git checkout main && git pull
# 1. update CHANGELOG.md (see below), then:
git commit -am "docs: update changelog for v1.1.0"
# 2. release
npm run release:patch    # 1.0.0 -> 1.0.1   bug fixes
npm run release:minor    # 1.0.0 -> 1.1.0   new features
npm run release:major    # 1.0.0 -> 2.0.0   breaking changes
```

That's it. Within a few minutes the new version is on npm and on the [GitHub Releases](https://github.com/OlaleyeFisayo/type-envgen/releases) page.

## Updating the changelog

Contributors add lines under `## [Unreleased]` in [CHANGELOG.md](../CHANGELOG.md) as part of their PRs. Before releasing:

1. Rename `## [Unreleased]` to the new version and date, e.g. `## [1.1.0] - 2026-11-02`, and add a fresh empty `## [Unreleased]` above it.
2. Update the compare links at the bottom:
   ```md
   [Unreleased]: https://github.com/OlaleyeFisayo/type-envgen/compare/v1.1.0...HEAD
   [1.1.0]: https://github.com/OlaleyeFisayo/type-envgen/compare/v1.0.0...v1.1.0
   ```
3. Commit it (`docs: update changelog for v1.1.0`) **before** running `release:*`, because `npm version` needs a clean working tree.

The GitHub Release gets auto-generated notes listing every merged PR, so the changelog only needs the user-facing highlights.

## Which command do I use?

type-envgen follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

| Command                 | When                                                                 | Examples                                                    |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run release:patch` | Bug fixes and internal changes. Nobody needs to change anything.     | Fix a parsing bug, improve an error message, update deps    |
| `npm run release:minor` | New features that don't break existing setups.                       | New `@default` tag, new `@type date`, new CLI flag          |
| `npm run release:major` | Anything that can break someone's existing `.env` or generated file. | Rename a flag, change an inferred type, drop a Node version |

When in doubt: if a user upgrading could get a different `env.ts` or a CLI error they didn't get before, it's **major**.

## What the release command does

Each `release:*` script runs `npm version`, which:

1. **Checks first** (`preversion`): runs `lint`, `typecheck` and `test:gen`. If anything fails, nothing is changed.
2. **Bumps** the version in `package.json` and `package-lock.json`.
3. **Commits** it as `chore(release): vX.Y.Z` and creates the git tag `vX.Y.Z`.
4. **Pushes** the commit and tag to `main` (`postversion`). As repo admin you can push straight to `main`; everyone else has to go through a PR.

Requirements: you're on `main`, it's up to date, and the working tree is clean (`npm version` refuses otherwise).

## What GitHub Actions does

Every push to `main` runs the [CI workflow](../.github/workflows/ci.yml):

1. `check (22)`, `check (24)`: lint, typecheck and tests on Node 22 and 24 (Linux)
2. `windows`: typecheck and tests on Windows
3. `smoke`: builds and runs the CLI on Node 20
4. `release`: only if all checks pass:
   - compares `package.json`'s version with what's on npm
   - **new version** → `npm publish` (with [provenance](https://docs.npmjs.com/generating-provenance-statements)) and creates a GitHub Release with auto-generated notes
   - **same version** → does nothing. Merging a normal PR never publishes by accident.

Watch it at [Actions](https://github.com/OlaleyeFisayo/type-envgen/actions), or from the terminal:

```sh
gh run watch
```

## Checking a release

```sh
npm view type-envgen version        # latest published version
npx type-envgen@latest --version    # run the published CLI
gh release view                     # latest GitHub Release
```

## Releasing changes from pull requests

1. Merge the PRs you want in the release (squash merge; the PR title becomes the commit message).
2. `git checkout main && git pull`
3. Update and commit `CHANGELOG.md` (see above), then run the right `release:*` command.

The GitHub Release notes list every merged PR since the last release.

## How publishing is authenticated

Publishing uses **[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)** (OpenID Connect). There is **no npm token or secret** to store, rotate or leak. npm trusts one specific workflow in this repo, and only that workflow can publish.

The connection is configured on npmjs.com → [type-envgen → Settings](https://www.npmjs.com/package/type-envgen/access) → **Trusted Publisher**:

| Field             | Value           |
| ----------------- | --------------- |
| Publisher         | GitHub Actions  |
| Organization/user | `OlaleyeFisayo` |
| Repository        | `type-envgen`   |
| Workflow filename | `ci.yml`        |
| Allowed actions   | `npm publish`   |

What this means in practice:

- The `release` job needs `permissions: id-token: write` and **npm 11.5.1 or newer**, which is why it runs on Node 24.
- Every published version automatically gets a [provenance statement](https://docs.npmjs.com/generating-provenance-statements) linking it to the exact commit and workflow run that built it.
- If you **rename `.github/workflows/ci.yml`** or move the publish step into another workflow file, update "Workflow filename" on npm too, or publishing fails.
- The package's "Publishing access" setting is **"Require two-factor authentication and disallow bypass 2fa tokens"**, so a leaked token can't publish. Trusted Publishing isn't affected by that setting.

## Troubleshooting

| Problem                                        | Fix                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm ERR! Git working directory not clean`     | Commit or stash your changes first.                                                       |
| `preversion` fails                             | Fix the lint/type/test error, commit the fix, run the release command again.             |
| Push rejected                                  | `git pull --rebase` on `main`, then `git push --follow-tags`.                             |
| `release` job: `401` / `403` / `ENEEDAUTH` on publish | The Trusted Publisher settings on npm don't match (owner, repo or **workflow filename**), the job lost `id-token: write`, or npm is older than 11.5.1. Fix it, then `gh run rerun --failed`. |
| `release` job: "cannot publish over previously published version" | That version is already on npm. Bump again with a `release:*` command.     |
| Release job skipped                            | A check failed. Fix it on `main`; the next push retries the release.                      |
| Published a broken version                     | Release a fix right away (`release:patch`). If needed, `npm deprecate type-envgen@X.Y.Z "reason"`. Avoid `npm unpublish`. |
