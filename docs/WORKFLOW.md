# Development workflow

Branching, commits, and PR conventions for this repo.

> This repo deliberately uses the **lightweight** variant of the standard
> workflow template (see
> `Reference/software-engineer/project-template/README.md`'s "When a
> project doesn't need the full ticket board"): no GitHub Projects v2
> board, no `create-ticket`/`start-ticket`/`ship-ticket` skills. `result`
> is a small, mature, published single-purpose library with an empty
> issue tracker at the time this was set up (2026-09-03) — the ticket
> board's Backlog/Ready/In progress/In review/Done lifecycle exists to
> coordinate multiple parallel work streams, and there's no backlog of
> parallel work here to coordinate. If that changes (a real backlog of
> feature requests builds up, more than one contributor is active at
> once), revisit this decision and adopt the full board rather than
> working around its absence.

## Branch naming

One branch per change, off `main`:

```
<type>/<slug>
```

`<type>` is `feat`, `fix`, `chore`, `docs`, `test`, or `refactor`.
`<slug>` is 2-4 kebab-case words describing the change. Example:
`feat/result-partition-empty-array-handling`. No issue-number prefix is
required (unlike a repo running the full ticket board) — if a change
does happen to reference a filed GitHub issue, still note it in the PR
body (`Closes #<N>` or `Refs #<N>` as appropriate), just don't require
one to exist first.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) header —
**not optional here**, unlike a purely stylistic convention elsewhere:
`release-please` (`.github/workflows/release-please.yml`) parses every
commit on `main` to decide the next semver bump and to generate
`CHANGELOG.md`. Get the type wrong and either the version bump is wrong
or the change silently drops out of the changelog.

```
feat(result): add Result.partition edge case for empty input

Refs #12
```

- `feat:` → minor bump. `fix:` → patch bump. A `BREAKING CHANGE:` footer
  (or `!` after the type/scope, e.g. `feat!:`) → major bump. Anything
  else (`chore:`, `docs:`, `test:`, `refactor:` without a breaking-change
  marker) doesn't bump the version but still shows up in history.
- If a commit closes a filed issue, put `Closes #<N>` in the **PR body**,
  not the commit — same reasoning as the full-board template: a
  `Closes`/`Fixes` keyword in a commit closes the issue the moment that
  commit lands on `main` through *any* path, before review has actually
  happened.

## Pull requests

- Target `main`.
- CI (`lint`, `format:check`, `build`, `test:coverage`) must be green —
  see `CLAUDE.md`'s "Commands." Don't merge on a red check.
- CodeRabbit reviews every PR automatically (`.coderabbit.yaml`,
  `profile: assertive`) — address its comments or explicitly note why
  one doesn't apply before merging; don't silently ignore them.
- Title mirrors the primary commit's summary (it becomes part of what
  `release-please` surfaces in the generated changelog entry, so make it
  read well on its own).

## Dependency updates

Dependabot PRs (see `CLAUDE.md`'s "Dependency management") don't need a
ticket — use the `check-dependabot-alerts` skill to triage and merge or
escalate them directly. Same PR requirements as above apply (green CI,
CodeRabbit addressed) before merging one.

## After merge

Nothing manual — `release-please` picks up the merged commit(s) on the
next push to `main` and keeps its release PR current. See `CLAUDE.md`'s
"Release process" for the full chain from there to an npm publish.

## Don't

- Don't hand-bump `package.json`'s `version` or hand-edit
  `CHANGELOG.md` — `release-please` owns both.
- Don't merge with a red CI check or unaddressed CodeRabbit feedback.
- Don't put `Closes #<N>` in a commit message — put it in the PR body if
  it applies at all.
- Don't add the GitHub Projects board or the ticket skills back in "for
  consistency" without an actual reason (a real backlog, more than one
  active contributor) — see the note at the top of this file.
