# Development

This page provides information for developers who want to contribute to or modify gh-manager-cli.

## Stack

- **UI:** `ink`, `ink-text-input`, `ink-spinner`
- **API:** `@octokit/graphql`, Apollo Client
- **Config paths:** `env-paths`
- **Language:** TypeScript
- **Build:** `tsup` (CJS output with shebang)

## Scripts

```bash
pnpm build          # build to dist/
pnpm build:binaries # build cross-platform binaries to ./binaries/
pnpm dev            # watch mode
pnpm start          # run normally
pnpm start:debug    # run with debug mode enabled
pnpm start:dev      # run with 5 repos per page and debug mode
pnpm test           # run the test suite (Vitest)
```

## Release Process

The project uses an automated, two-phase release workflow.

### Phase 1: Version Creation

Triggers on feature/fix commits to `main`. Uses semantic-release to analyse commit messages:

- `feat:` → minor bump
- `fix:` → patch bump
- `BREAKING CHANGE:` → major bump

Actions:

1. Analyse commits since the last release.
2. Calculate the new version.
3. Update `package.json` and `CHANGELOG.md`.
4. Create a git tag.
5. Publish to NPM.
6. Commit changes as `chore(release): X.Y.Z`.

### Phase 2: Binary Building & Distribution

Triggers on `chore(release):` commits. Actions:

1. Build binaries for Linux, macOS, and Windows.
2. Create a GitHub release with the changelog.
3. Upload binaries to the release.
4. Publish to GitHub Packages.
5. Update the Homebrew formula.

### Manual Release

```bash
# Update version in package.json
npm version patch  # or minor/major
git push origin main
```

Both NPM and Homebrew are automatically updated within minutes of any version change.

## Environment Variables

- `REPOS_PER_FETCH`: repositories to fetch per page (1-100, default: 100)
- `GH_MANAGER_DEBUG=1`: enables debug mode with performance metrics, detailed errors, and console logging
- `GH_TOKEN`: GitHub Personal Access Token (alternative to OAuth)
- `NO_COLOR`: disable coloured output in terminal

See [Apollo Cache (Performance)](Apollo-Cache.md) for caching-related variables (`APOLLO_TTL_MS`) and [Logging](Logging.md) for debug logging behaviour.

## Project Layout

- `src/index.tsx` — CLI entry, flag parsing, error handling, end-of-session summary
- `src/types.ts` — shared types
- `src/ui/App.tsx` — token bootstrap, renders `RepoList`
- `src/ui/views/` — `RepoList.tsx` (main list UI, key handling, modal management)
- `src/ui/OrgSwitcher.tsx` — organisation switching component
- `src/ui/hooks/` — `useTheme` and other shared hooks
- `src/ui/components/` — modular components:
  - `modals/` — Delete, Archive, Sync, Info, Logout, Rename, Transfer, CopyUrl, CreateRepo, ChangeVisibility, Visibility, Sort, SortDirection, ArchiveFilter, Star, Unstar, OpenInBrowser, and the Bulk\* modals plus `bulkActions.ts`
  - `repo/` — RepoRow (memoised with React.memo), FilterInput, RepoListHeader
  - `auth/` — AuthMethodSelector, OAuthProgress
  - `common/` — SlowSpinner and shared UI elements
- `src/services/` — `github.ts` (GraphQL client and queries), `oauth.ts` (device-flow auth), `apolloMeta.ts` (Apollo cache management)
- `src/config/` — `config.ts` (token read/write and UI preferences), `constants.ts`, `themes.ts` (colour themes)
- `src/lib/` — `logger.ts` (structured logging with rotation), `utils.ts` (truncate, formatDate), `session.ts` (usage tracking + summary), `fuzzySearch.ts` (fuse.js search)
- `viewlogs.sh` — utility script for viewing logs

## Related Pages

- [Apollo Cache (Performance)](Apollo-Cache.md) — caching, debug mode, and cache configuration
- [Logging](Logging.md) — log locations, rotation, and what is recorded
- [Testing](Testing.md) — testing documentation
- [Troubleshooting](Troubleshooting.md) — diagnosing common issues
