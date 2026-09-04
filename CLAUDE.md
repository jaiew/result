# CLAUDE.md

Working conventions for this repo — read this before making changes here,
whether you're Claude Code or a person.

## What this is

`@jaiew/result` — a zero-dependency, type-safe implementation of the
Result pattern for TypeScript (`ok`/`err`/`Result`, `map`/`mapError`/
`flatMap`, `match`, `Result.gen`, `Result.try`, `Result.fromPromise`,
`Result.all`/`allSettled`/`partition`, and more). Published to npm as
`@jaiew/result`, MIT licensed, publicly available. It's also the
standard error-handling library the user's own TypeScript projects adopt
project-wide instead of throwing (see e.g. `jaiew/substack-mcp`'s
`CLAUDE.md`) — so a breaking API change here has real downstream blast
radius, not just this repo's own test suite.

No separate spec/backlog document — the README's API reference *is* the
spec; a new method isn't done until the README documents it the same way
as every existing one. Branching/commit/PR conventions live in
[`docs/WORKFLOW.md`](docs/WORKFLOW.md) — note that this repo runs a
**lightweight** flow (no GitHub Projects board, no ticket skills): see
that doc for why.

## Architecture

- **Single-file library.** All public API lives in `src/index.ts` — the
  `Result<T, E>` union type, the `OkResult`/`ErrorResult` classes behind
  it, `ok()`/`err()`, and every `Result.*` namespace utility. There's no
  internal module split; keep it that way unless the file's size genuinely
  starts hurting navigation (it's ~30KB as of v1.2.0, still one
  well-organized file).
- **Zero runtime dependencies.** `package.json`'s `dependencies` field
  must stay empty — everything under `devDependencies` is build/test/lint
  tooling only, never something the published package imports at runtime.
  This is a load-bearing property for a library other projects depend on
  for their own error handling; don't add a runtime dependency without
  discussing it with the user first, even a small one.
- **Build:** `tsup` compiles `src/index.ts` to a hybrid ESM+CJS package
  (`dist/index.js` / `dist/index.cjs` / `dist/index.d.ts`) per
  `tsup.config.ts`. `package.json`'s `exports` map is what makes both
  `import` and `require` consumers work — if you change the build output
  shape, update `exports` and `files` (currently just `["dist"]`) to
  match.
- **Tests live beside the code they test:** `src/index.test.ts`, not a
  separate `test/` tree — this is a one-file library, so a one-file test
  suite mirrors it.

## Error handling convention

This repo is the canonical *implementation* of the Result convention
other repos document as their own error-handling standard — it doesn't
itself consume `Result` internally, because it has no I/O or expected
failure paths of its own to model with it. Ordinary TypeScript
(including a thrown exception inside a narrowly-scoped internal helper,
e.g. `unwrap()`'s intentional throw on an `ErrorResult`) is fine here.
What matters instead: the **public API surface must behave exactly as
documented** for every method in the README's API reference table — that
correctness contract is this repo's actual "error handling convention."

## Adding a new method

1. Check the README's API reference first — if something adjacent
   already exists, extend or compose with it rather than adding a
   near-duplicate.
2. Implement it in `src/index.ts`, matching the existing style (JSDoc
   comment above each public method, consistent with what's already
   there).
3. Add tests in `src/index.test.ts` covering both the `Ok` and `Err`
   paths, plus any edge case the method's contract implies (e.g. an
   async variant needs both a resolving and a rejecting case). `npm run
   test:coverage` gates on this in CI — don't ship a method with an
   untested branch.
4. **Update `README.md`** in the same change — add the method to the
   feature bullet list if it's a new capability class, and to the API
   reference table/section with a short usage example matching the
   existing entries' shape. A method that exists in code but not in the
   README isn't finished.
5. Do **not** hand-edit `CHANGELOG.md` — `release-please` generates it
   from Conventional Commits on every push to `main` (see "Release
   process" below). Editing it by hand will conflict with that.

## Testing

- **Framework:** Vitest + `@vitest/coverage-v8` for coverage.
- **Commands:** `npm run test` (`vitest run`), `npm run test:watch`,
  `npm run test:coverage` (what CI runs — also what `prepublishOnly`
  runs before a publish).
- Coverage uploads to Codecov in CI (conditional on a `CODECOV_TOKEN`
  secret being set) — the badge in `README.md` reflects `main`'s
  coverage.

## Development workflow

Full detail: [`docs/WORKFLOW.md`](docs/WORKFLOW.md). Summary:

- Branch per change: `<type>/<slug>` (no issue-number prefix required —
  see `docs/WORKFLOW.md` for why this repo skips the ticket-numbering
  convention other repos use).
- Commits: **Conventional Commits header is not optional here** — beyond
  being good practice, `release-please` parses every commit on `main` to
  decide the next version bump and generate `CHANGELOG.md`. A wrongly
  typed commit type (e.g. `update:` instead of `fix:`/`feat:`) either
  produces a wrong version bump or gets silently excluded from the
  changelog.
- PRs target `main`; CI (lint, format:check, build, test:coverage) and
  CodeRabbit's automatic review (`.coderabbit.yaml`) both run — don't
  merge on a red CI check, and address or explicitly dismiss CodeRabbit's
  comments before merging.
- No GitHub Projects board, no `create-ticket`/`start-ticket`/
  `ship-ticket` skills — this repo tracks work as plain GitHub issues (if
  any) and PRs directly. See `docs/WORKFLOW.md`.

## Commands

- `npm run build` — `tsup`, produces `dist/`
- `npm run test` — `vitest run`
- `npm run test:watch` — `vitest` in watch mode
- `npm run test:coverage` — `vitest run --coverage` (what CI/prepublish run)
- `npm run lint` — `eslint .`
- `npm run lint:fix` — `eslint . --fix`
- `npm run format` — `prettier --write "src/**/*.ts"`
- `npm run format:check` — `prettier --check "src/**/*.ts"` (CI-safe)
- `npm run prepublishOnly` — chains `format:check` → `lint` → `build` →
  `test:coverage`; runs automatically before `npm publish`, but also
  useful to run by hand as a full local pre-flight check.

## Dependency management

- **Bump cooldown:** don't bump any dependency to its latest release
  until at least 2 days have passed since that release, unless the
  release fixes a critical CVE — bump immediately regardless of cooldown
  in that case. Check the actual latest version and release date
  (`npm view <pkg> time --json`) before bumping rather than trusting
  whatever a Dependabot PR happened to open with, since a newer release
  may have shipped since.
- **Dependabot** is already configured (`.github/dependabot.yml` — npm +
  github-actions ecosystems, weekly). Use the `check-dependabot-alerts`
  skill to triage open alerts/PRs and confirm CI (`lint` + `format:check`
  + `build` + `test:coverage`) is green on GitHub's own runner before
  merging — that's the real build gate; there's no need to re-run it
  locally against an unreviewed branch. Every current npm-ecosystem
  Dependabot-managed dependency here is a `devDependency` (this repo has
  zero runtime deps — see "Architecture" above), which lowers the blast
  radius of a bad bump but doesn't remove the need to verify it;
  github-actions-ecosystem updates (workflow action pins) aren't npm
  dependencies and are verified by re-running the affected workflow
  instead.
- **CodeQL** (`.github/workflows/codeql.yml`) runs separately as a
  security scan — its findings aren't Dependabot alerts and aren't
  covered by `check-dependabot-alerts`; triage a CodeQL finding on its
  own terms if one comes up.

## Release process

This repo's release flow is fully automated by `release-please`
(`.github/workflows/release-please.yml`) — don't hand-bump
`package.json`'s `version` or hand-edit `CHANGELOG.md`:

1. Every push to `main` (i.e. every merged PR, given Conventional
   Commits) is parsed by `release-please`, which maintains an
   always-up-to-date "Release PR" with the next version bump and
   generated changelog.
2. Merging that release PR creates a GitHub Release.
3. `publish.yml` triggers on that Release being published and runs
   `npm publish --access public`.

The only manual step in that whole chain is merging the release PR when
you're ready to cut a release — everything else, including the actual
npm publish, is automatic. This is also why Conventional Commits on
`main` isn't just style here (see "Development workflow" above) — it's
literally what drives the version number.

## Scope discipline

Small, deliberately minimal public API — a Result/Either implementation,
not a general functional-programming utility belt. A new method earns
its place by composing naturally with the existing `Result<T, E>`
pipeline (the way `filter`, `inspect`, and the `mapAsync`/`flatMapAsync`
pair do) — not just "this is generically useful." When in doubt whether
something belongs here vs. in a consuming project's own utility code,
default to leaving it out of this library.
