# Release Process

Releases come from [stealth-factory/gh-manager-cli](https://github.com/stealth-factory/gh-manager-cli), using `.github/workflows/release.yml` and the semantic-release configuration in `package.json`.

## Published Packages and Commands

| Destination | Package or repository | User command |
|---|---|---|
| npm (canonical) | `@stealth-factory/gh-manager-cli` | `npx @stealth-factory/gh-manager-cli@latest` |
| npm (compatibility) | `gh-manager-cli` | `npx gh-manager-cli@latest` |
| GitHub Packages | `@stealth-factory/gh-manager-cli` | Requires GitHub registry configuration |
| Homebrew | `stealth-factory/homebrew-tap` | `brew install stealth-factory/tap/gh-manager-cli` |
| Standalone binaries | GitHub Releases | Platform-specific `gh-manager-cli-*` executable |

The executable remains `gh-manager-cli`. Configuration, preferences, cache, and log paths retain the application name, regardless of npm scope.

## Phase 1: Version and npm Publication

On a non-release commit pushed to `main`, semantic-release:

1. Analyses conventional commits since the last release.
2. Calculates the release version.
3. Updates `package.json` and the generated `CHANGELOG.md`.
4. Prepares the compatibility package in `.release/legacy`.
5. Commits the release metadata as `chore(release): X.Y.Z` and creates a tag.
6. Publishes `@stealth-factory/gh-manager-cli` publicly on npm.
7. Publishes the same-version `gh-manager-cli` compatibility launcher.

The local `scripts/release-legacy-package.js` plugin follows `@semantic-release/npm` in the plugin list. Its launcher imports the scoped package in the same process, retaining CLI arguments and exit behaviour, and depends on that exact version. It performs no runtime package installation.

Do not manually bump the version or edit `CHANGELOG.md`. `feat:` triggers a minor release; `fix:` and `perf:` trigger patch releases; a breaking-change marker triggers a major release. Documentation and maintenance commits alone do not normally trigger publication.

The two npm publications are sequential, not atomic. If the scoped publication succeeds and the compatibility publication fails, the previous short-command version remains available; repair it using the migration guide.

## Phase 2: Binaries, GitHub Packages, and Homebrew

The release metadata commit triggers the second phase:

1. Build Linux, macOS, and Windows binaries using the pinned `@yao-pkg/pkg` and `node22` targets.
2. Create the GitHub release from the generated changelog and upload binaries.
3. Build the application and publish the scoped package to GitHub Packages.
4. Download the scoped tarball from the public npm registry, hash it, and update `Formula/gh-manager-cli.rb` in `stealth-factory/homebrew-tap`.

The npmjs publish configuration stays intact while the GitHub Packages step uses an explicit registry and temporary authentication configuration. Homebrew uses the published npmjs archive, rather than a local `npm pack` checksum.

Downstream release and publication jobs check out the triggering commit (`github.sha`), matching the binary build. They do not read a newer version from `main` while a release is running. A missing tap token or rejected formula push fails the deployment job; a retry with no formula changes succeeds without another commit.

`GH_TOKEN` must permit the release commit to trigger another workflow run. A push authenticated with the default `GITHUB_TOKEN` does not trigger another push workflow; that fallback alone is insufficient for phase 2.

## Credentials After the Repository Transfer

- `NPM_TOKEN`: must permit public publication under the `stealth-factory` organisation and updates to the original unscoped `gh-manager-cli` package.
- `GH_TOKEN`: must allow repository/tag/release writes for `stealth-factory/gh-manager-cli` and formula pushes to `stealth-factory/homebrew-tap`.
- `GITHUB_TOKEN`: the `publish-extras` job requests `packages: write` for publishing under the new GitHub organisation. Check the organisation's package creation policy.
- If using npm trusted publishing, update the configured GitHub owner/repository to `stealth-factory/gh-manager-cli` and authorise both npm packages. The current workflow uses `NPM_TOKEN`; an OIDC migration needs corresponding workflow configuration.

See [npm Scope Migration](NPM_SCOPE_MIGRATION.md) for first publication and verification.

## Manual Trigger and Recovery

Use GitHub Actions → **Release Pipeline** → **Run workflow**. Semantic-release still requires releasable commits; a manual trigger does not force a version bump.

For an interrupted second phase, retry the failed workflow and inspect the job conditions.

Do not run `npm version` to force a release. For a compatibility-package-only failure, use the recovery steps in [NPM_SCOPE_MIGRATION.md](NPM_SCOPE_MIGRATION.md). For tap repair, use [HOMEBREW.md](HOMEBREW.md).

## Validation

Before merging release changes:

```bash
FORCE_COLOR=1 pnpm test
pnpm typecheck
pnpm build
npm pack --dry-run
pnpm legacy:prepare
npm pack ./.release/legacy --dry-run
```

A passing local check proves the artifacts can be prepared; confirm registry versions, GitHub release assets, and the tap formula separately after publication.
