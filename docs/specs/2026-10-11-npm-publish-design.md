# Publish to npm on release: design spec

- **Date:** 2026-10-11
- **Status:** Design approved in conversation (2026-10-11), with staged publishing chosen by the user
- **Based on:** StylesUI's `.github/workflows/publish.yml`

## 1. Problem

Releases reach npm by hand. 0.1.0 went out from a laptop: `npm stage publish` created the `0.0.0-stage` placeholder, then the staged 0.1.0 was approved. Nothing checks that what reaches npm was built from the tagged commit, that it passed CI, or that its version matches the release. The package also carries no provenance.

## 2. Intent and success criteria

**Intent:** publishing a GitHub release stages that version on npmjs.org with no other manual step and no long-lived npm token, and the version goes live once a maintainer approves it.

**Success looks like:**

1. Publishing a release tagged `v<version>` stages `@krelborn/markdown-review@<version>` on npmjs.org.
2. Nothing is staged unless the tagged commit passes everything CI runs, including the e2e tests.
3. A release whose tag doesn't match `package.json`, or whose commit isn't on `main`, fails in seconds, before CI runs and before anything is staged.
4. A pre-release is staged with the `next` dist-tag, so approving it leaves `latest` alone.
5. The workflow holds no npm secret, and nothing it stages is public until a maintainer approves it with 2FA.
6. An approved version shows a provenance attestation that links it to its workflow run.
7. `@krelborn/stylesui` still installs from GitHub Packages in CI.

## 3. What StylesUI does

StylesUI's `publish.yml` runs on `release: published` as one job. It installs with `cache: pnpm`, runs lint, typecheck, test and build, then runs `pnpm publish --no-git-checks --tag beta|latest` (picked from the release's pre-release flag) against GitHub Packages, authenticated with `GITHUB_TOKEN` and `packages: write`.

| Keep | Change for markdown-review | Why |
| --- | --- | --- |
| Trigger on `release: published` | | Publishing the release is the deliberate act; drafts don't trigger it |
| A dist-tag picked from the pre-release flag | `next` rather than `beta`, and the flag must agree with the version | See decision 8 |
| | `npm stage publish` instead of `pnpm publish` | See decisions 2 and 10 |
| | Verification calls `ci.yml` instead of copying its steps | StylesUI's copy has already drifted: it skips `format:check`. Ours would also need the e2e setup |
| | The publish permission lives in its own job, after verification | StylesUI's single job holds `packages: write` while it runs tests and their dependencies |
| | No dependency cache in the job that builds the package | npm's guidance for release builds: a poisoned cache would ship in the package |
| | Check that the tag is `v` + `package.json`'s version, and that its commit is on `main` | StylesUI would publish whatever version `package.json` has, whatever the release is called, from any branch |
| | Authenticate to npm with trusted publishing (OIDC), not a token | npmjs.org can't use `GITHUB_TOKEN` |

## 4. Decisions

| # | Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- | --- |
| 1 | npm authentication | Trusted publishing: the job gets `id-token: write` and npm swaps the GitHub OIDC token for a short-lived token | An `NPM_TOKEN` repository secret | No secret to leak or rotate, and npm attaches provenance automatically for a public repo and package. Staged publishes carry it too, because `npm stage publish` takes the same path as `npm publish` |
| 2 | Publish mode | `npm stage publish`: CI uploads the version, and a maintainer approves it with 2FA on npmjs.com or with `npm stage approve` | `npm publish`, straight to the registry | Chosen by the user. Every version needs a human with 2FA before it goes live, so a compromised workflow or dependency can't publish on its own. npm recommends this, and it's the default for trusted publishers created after 2026-09-03. Approving takes one step per release |
| 3 | Verification | `ci.yml` gains a `workflow_call` trigger and `publish.yml` calls it | Copy CI's steps into `publish.yml`, as StylesUI does | One definition of "passes", including the e2e tests in Chromium and WebKit |
| 4 | Job layout | `check`, then `verify` (calls `ci.yml`), then `publish`. Only `publish` has `id-token: write` | One job; `check` and `verify` in parallel | The tests run a lot of third-party code, which shouldn't be able to mint a publish token. `check` stops a mistagged release in seconds, before the e2e tests start. The build still runs in `publish`, through `prepublishOnly`, so Vite and its plugins run where a token can be minted. Moving it out would mean packing in one job and staging the tarball in another; that isn't worth it while the trusted publisher can only stage and approval needs 2FA |
| 5 | Node in the publish job | The latest 24 (`check-latest: true`) | 22 plus `npm install -g npm@latest`; Node 24 as cached on the runner | `npm stage` needs npm 11.15 or later. Node 24.18 and later bundle npm 11.16 or later (24.21.0 has 11.19.0); Node 22 bundles npm 10. Without `check-latest`, `setup-node` may use an older Node 24 from the runner's cache. This also avoids downloading an unpinned npm in the release job. CI stays on 22 |
| 6 | Registry routing | No `registry-url` in `setup-node`. The existing `publishConfig["@krelborn:registry"]` sends the publish to npmjs.org | `registry-url` and `scope` in `setup-node`, as StylesUI does | The repo's `.npmrc` maps `@krelborn` to GitHub Packages for the StylesUI install, and a project `.npmrc` overrides the user config `setup-node` writes. `publishConfig` already handles this (c3fa0db), and 0.1.0 reached npmjs.org with it. npmjs.org is npm's default registry anyway |
| 7 | Cache | None in `publish` | `cache: pnpm` | npm's guidance for release builds. `verify` keeps CI's cache, because nothing it builds is published |
| 8 | Dist-tag | `next` for a pre-release, `latest` otherwise. `check` requires the pre-release flag to be set exactly when the version has a pre-release part such as `-beta.1` | `beta`, as StylesUI does | The README already calls the whole product beta, so a `beta` dist-tag beside `latest` would mislead. Without the check, a stable version marked pre-release would miss `latest`, and npm refuses to stage a pre-release version without an explicit `--tag`. A staged version's tag can't be changed, only rejected and staged again |
| 9 | Pinning the publish | The trusted publisher names `Krelborn/markdown-review` and `publish.yml`, with no environment, and allows only `npm stage publish` | A GitHub environment `npm` with a `v*` tag rule, named in the trusted publisher too | There's one maintainer, the workflow only runs for releases, and approval already needs 2FA. An environment can be added later; it would need a new trusted publisher, because npm can't edit one |
| 10 | Publish command | `npm stage publish` in the package directory, after `pnpm install` | `pnpm pack`, then `npm stage publish <tarball>` | pnpm has no `stage` command. npm runs `prepublishOnly` (`pnpm build`) and packs `files` itself, the same path 0.1.0 took by hand. The package has no `workspace:` or `catalog:` ranges for `pnpm pack` to rewrite |
| 11 | Release branch | `check` requires the tagged commit to be on `main`, with a full-history checkout | Trust the release form, which targets `main` by default | A release cut from another branch would otherwise stage untested work on `latest`. The check costs one `git merge-base` |

## 5. The workflows

### `.github/workflows/ci.yml`

Only the trigger changes:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  # publish.yml runs it on the release's commit before publishing
  workflow_call:
```

When `publish.yml` calls it, it checks out the release's tag and keeps its own `contents: read` and `packages: read`, which the caller grants. `secrets.GITHUB_TOKEN` is passed to called workflows automatically.

### `.github/workflows/publish.yml`

```yaml
name: Publish to npm

on:
  release:
    types: [published]

permissions: {}

jobs:
  check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          # The whole history, so the next step can find the commit on main
          fetch-depth: 0

      - name: Check the release's commit is on main
        run: |
          if ! git merge-base --is-ancestor HEAD origin/main; then
            echo "::error::The release's commit is not on main"
            exit 1
          fi

      - name: Check the release matches package.json
        env:
          TAG: ${{ github.event.release.tag_name }}
          PRERELEASE: ${{ github.event.release.prerelease }}
        run: |
          version="$(jq -r .version package.json)"
          if [ "$TAG" != "v$version" ]; then
            echo "::error::The release is tagged $TAG, but package.json has version $version"
            exit 1
          fi
          # Build metadata such as +build.1 can contain a hyphen too
          case "${version%%+*}" in
            *-*) expected=true ;;
            *) expected=false ;;
          esac
          if [ "$PRERELEASE" != "$expected" ]; then
            echo "::error::Mark the release as a pre-release exactly when its version has a pre-release part, such as 0.2.0-beta.1"
            exit 1
          fi

  verify:
    needs: check
    permissions:
      contents: read
      packages: read
    uses: ./.github/workflows/ci.yml

  publish:
    needs: verify
    runs-on: ubuntu-latest
    permissions:
      contents: read
      # Install @krelborn/stylesui from GitHub Packages
      packages: read
      # npm trusted publishing
      id-token: write
    env:
      # .npmrc reads it to install @krelborn/stylesui from GitHub Packages
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      # npm stage needs npm 11.15 or later, which Node 24.18 and later bundle.
      # No cache: a poisoned one would ship in the package.
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          check-latest: true

      - run: pnpm install --frozen-lockfile

      # prepublishOnly runs pnpm build. A maintainer approves the staged version on npmjs.com.
      - run: npm stage publish --tag ${{ github.event.release.prerelease && 'next' || 'latest' }}
```

The release's tag and flag reach the shell through `env`, not inline `${{ }}`, so a tag name can't inject shell. The `--tag` expression can only produce `next` or `latest`.

## 6. One-time setup on npmjs.com

1. Merge the workflows.
2. When the first automated release is ready, add the trusted publisher. A new trusted publisher expires unless it is used successfully within 2 days, so add it on the day of the release. In the package's settings, under **Trusted Publisher**, choose GitHub Actions and enter:
   - Organization or user: `Krelborn`
   - Repository: `markdown-review`
   - Workflow filename: `publish.yml`
   - Environment: blank
   - Allowed actions: `npm stage publish` only. Leave `npm publish` and dist-tag management off.

   Or, from outside this repository (its `.npmrc` sends `@krelborn` to GitHub Packages), with a recent npm: `npx npm@latest trust github @krelborn/markdown-review --repo Krelborn/markdown-review --file publish.yml --allow-stage-publish`.
3. Cut the release (section 7).
4. Once a version has gone out through the workflow, set **Publishing access** to "Require two-factor authentication and disallow tokens", and revoke any npm tokens that could publish. Trusted publishing keeps working, because it doesn't use tokens.

## 7. Releasing

`AGENTS.md` gains a Releasing section:

1. In a pull request, set `version` in `package.json`, and merge it.
2. Publish a GitHub release from `main`, tagged `v<version>`. Mark it as a pre-release exactly when the version has a pre-release part.
3. The workflow checks that the tagged commit is on `main` and that the tag matches `package.json`, runs CI on that commit, then stages the version.
4. Approve it with 2FA in the package's Staged Packages tab on npmjs.com, or with `npm stage approve <stage-id>` (npm 11.15 or later). Check the version and dist-tag first: npm's guard against moving `latest` to an older version doesn't fire here, apparently because it looks up existing versions on the scope's registry, GitHub Packages. The publish job's log ends with `+ @krelborn/markdown-review@<version> (staged with id <stage-id>)`. `npm stage download <stage-id>` fetches the tarball to inspect first, and `npm stage reject <stage-id>` withdraws it.

When something goes wrong:

- `check` or `verify` failed for a real reason: nothing reached npm. Delete the release and its tag, fix `main`, and release the same version again.
- A job failed on something transient, such as a flaky e2e test: re-run the failed jobs from the run's page.
- A staged version is wrong: reject it, which frees the version, then fix `main` and release again. A staged version takes up its version number like a published one, so a second stage of the same version fails until the first is rejected.

## 8. Rollout and testing

The workflow can only be exercised by a real release. Staging is the safety net: a bad run leaves an unapproved stage to reject, not a public version. Before merging, lint both workflows with `actionlint`. `npm stage publish --dry-run --tag next`, run with a temporary pre-release version in `package.json`, shows the build, the files, and that the stage would go to npmjs.org with the right tag; without `--tag` it should refuse.

Run the commands below outside this repository: inside it, `.npmrc` sends `@krelborn` to GitHub Packages. The first run is right when:

1. The publish job's log shows the version staged with the expected dist-tag, and `npm stage list @krelborn/markdown-review` lists it.
2. After approval, `npm view @krelborn/markdown-review dist-tags` shows the version on the expected tag.
3. The version's page on npmjs.com shows provenance linked to the workflow run.
4. `npx @krelborn/markdown-review@<version> --version` runs the new CLI.

## 9. Files

- `.github/workflows/publish.yml`: new
- `.github/workflows/ci.yml`: adds `workflow_call`
- `AGENTS.md`: a Releasing section
