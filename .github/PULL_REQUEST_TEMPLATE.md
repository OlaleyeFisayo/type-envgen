<!--
Thanks for contributing! Please make sure the PR title follows Conventional Commits,
e.g. "feat: add @default tag" or "fix: handle # inside quoted values".
It becomes the commit message when the PR is squash-merged.
-->

## Summary

<!-- What does this PR change, and why? -->

Closes #<!-- issue number, if any -->

## Type of change

- [ ] `fix` — bug fix (no breaking change)
- [ ] `feat` — new feature (no breaking change)
- [ ] `docs` — documentation only
- [ ] `refactor` / `perf` / `test` / `chore`
- [ ] **Breaking change** — existing `.env` files or generated output behave differently (add `!` to the title, e.g. `feat!: ...`)

## How was this tested?

<!-- Commands you ran, sample .env lines, before/after output. -->

## Checklist

- [ ] The PR does one focused thing
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass locally
- [ ] New behavior has a case in `src/core/test/.env` and a test in the matching `src/core/test/*.test.ts`
- [ ] README / `--help` updated if user-facing behavior changed
- [ ] Line added under `## [Unreleased]` in `CHANGELOG.md` (user-facing changes only)
- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org)
