---
name: check-dependabot-alerts
description: Triage open Dependabot security alerts and dependency-update PRs for @jaiew/result, confirm each update's CI run is green (lint/format:check/build/test:coverage), and merge or escalate. Use when asked to "check dependabot alerts", "review dependabot PRs", "clear the dependabot queue", or on a scheduled weekly dependency review.
---

# Check Dependabot alerts

Dependabot (`.github/dependabot.yml` — npm + github-actions ecosystems,
weekly) opens two different kinds of thing in this repo, and they need
different handling:

- **Security alerts** — a vulnerability found in a dependency already in
  use, whether or not a fix PR has been opened yet
  (`gh api repos/jaiew/result/dependabot/alerts`, or Settings → Security
  → Dependabot alerts).
- **Version-update PRs** — routine bumps opened directly against `main`
  by `dependabot[bot]`.

This skill covers both. Every npm-ecosystem dependency Dependabot manages
here is a `devDependency` — this library has zero runtime dependencies by
design (see `CLAUDE.md`'s "Architecture") — which lowers the blast radius
of a bad bump (nothing published to npm changes just because a dev tool
changed) but doesn't remove the need to verify one, since a broken
lint/build/test toolchain still blocks every future release.
github-actions-ecosystem updates (workflow action version pins) are a
separate case — there's no `npm install` for those, and no
lint/build/test toolchain to run; verify them by re-running the affected
workflow instead.

## Steps

1. **Pull the current state**:
   ```bash
   gh api repos/jaiew/result/dependabot/alerts --paginate \
     --jq '.[] | select(.state=="open") | {number, severity: .security_advisory.severity, package: .dependency.package.name, summary: .security_advisory.summary}'
   gh pr list --repo jaiew/result --app dependabot --json number,title,url,createdAt
   ```
2. **Triage by severity, not arrival order.**
   - **Critical** — urgent regardless of the 2-day bump cooldown in
     `CLAUDE.md`. If a fix PR already exists, go straight to step 3. If
     not, bump by hand on a branch rather than waiting for Dependabot's
     next scheduled run — `npm install <pkg>@<fixed-version> --save-dev`
     for the npm ecosystem, or edit the pinned version/SHA directly in
     the workflow YAML for the github-actions ecosystem.
   - **High/Medium/Low** — can wait for Dependabot's own PR and the
     normal cooldown.
   For each open version-update PR:
   - Check whether it's cleared the 2-day cooldown — `npm view <pkg>
     time --json` for an npm-ecosystem PR, the action's own
     releases/tags for a github-actions-ecosystem PR. If not, and
     there's no critical CVE forcing it, leave it open.
   - **Major version bumps** to a tool this repo's release chain depends
     on directly — `tsup`, `vitest`/`@vitest/coverage-v8`, `typescript`,
     `eslint`/`typescript-eslint` — get extra scrutiny: skim the
     changelog for breaking changes before merging, even with green CI,
     since a major bump to the build/test toolchain itself can silently
     change what "passing" means.
3. **Confirm the PR's CI check is green:**
   ```bash
   gh pr checks <PR-number>
   ```
   `.github/workflows/ci.yml` already runs `npm ci` → lint →
   format:check → build → test:coverage — the same gate
   `prepublishOnly` runs before a real release — on a GitHub-hosted
   runner for every PR, Dependabot's included. That's a safer place to
   execute an unreviewed branch's install/build scripts than your own
   machine, so don't `gh pr checkout` and re-run them locally; a green
   CI check here is the real build passing.
4. **Decide, per PR:**
   - **Clean + low-risk (patch/minor, no breaking-change notes):** merge
     it (`gh pr merge <N> --squash --delete-branch`) — squash merge keeps
     `release-please`'s commit parsing simple (one Conventional Commits
     message per PR; Dependabot's own commit messages are already
     `chore(deps): ...` / `chore(deps-dev): ...` and don't trigger a
     version bump, which is correct for a dev-only dependency change).
   - **Clean but a major bump to a toolchain dependency:** still merge if
     checks pass and the changelog review found nothing concerning, but
     say so explicitly in your summary rather than merging silently.
   - **Broken (any check fails):** don't merge. Comment on the PR
     explaining what failed. If fixing it is real work (not a one-line
     pin or config tweak), open a regular GitHub issue for it — this repo
     has no ticket board or `create-ticket` skill (see
     `docs/WORKFLOW.md`), so a plain issue is the right tracking unit
     here.
   - **A security alert with no upstream fix yet:** don't merge anything
     broken to "resolve" it. Note the alert and flag it to the user —
     don't let a Critical/High alert go unmentioned just because there's
     nothing mergeable yet.
5. **Report a summary**: what merged, what's waiting on cooldown, what's
   blocked and why, and anything needing a human decision (no fix
   available, a major toolchain bump, any Critical/High alert).

## Don't

- Don't `gh pr checkout` and re-run `npm ci`/build/test scripts from an
  unreviewed Dependabot branch locally — trust the CI run instead (step
  3); that's what keeps unreviewed branch code off your own credentials.
- Don't apply the 2-day cooldown to a critical security alert.
- Don't silently merge a major bump to a toolchain dependency — say so in
  the summary even when it's clean.
- Don't hand-edit `CHANGELOG.md` or `package.json`'s `version` while doing
  this — `release-please` owns both (see `CLAUDE.md`'s "Release
  process"); a Dependabot merge just becomes another commit it picks up
  on the next push to `main`.
