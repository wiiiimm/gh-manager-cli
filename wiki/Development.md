# Development

This page provides information for developers who want to contribute to or modify gh-manager-cli.

## Tech Stack

- UI: `ink`, `ink-text-input`, `ink-spinner`
- API: `@octokit/graphql`, Apollo Client
- Config paths: `env-paths`
- Language: TypeScript
- Build: `tsup` (CJS output with shebang)

## Development Scripts

```bash
pnpm build          # build to dist/
pnpm build:binaries # build cross-platform binaries to ./binaries/
pnpm dev            # watch mode
pnpm start          # run normally
pnpm start:debug    # run with debug mode enabled
pnpm start:dev      # run with 5 repos per page and debug mode
```

## Environment Variables

- `REPOS_PER_FETCH`: Number of repositories to fetch per page (1-50, default: 15)
- `GH_MANAGER_DEBUG=1`: Enables debug mode with performance metrics and detailed errors

## Project Layout

- `src/index.tsx` — CLI entry and error handling
- `src/ui/App.tsx` — token bootstrap, renders `RepoList`
- `src/ui/RepoList.tsx` — main list UI with modal management
- `src/ui/components/` — modular components (modals, repo, common)
  - `modals/` — DeleteModal, ArchiveModal, SyncModal, InfoModal, LogoutModal
  - `repo/` — RepoRow, FilterInput, RepoListHeader
  - `common/` — SlowSpinner and shared UI elements
- `src/ui/OrgSwitcher.tsx` — organization switching component
- `src/github.ts` — GraphQL client and queries (repos + rateLimit)
- `src/config.ts` — token read/write and UI preferences
- `src/types.ts` — shared types
- `src/utils.ts` — utility functions (truncate, formatDate)
- `src/apolloMeta.ts` — Apollo cache management

## Apollo Cache (Performance)

gh-manager-cli includes built-in Apollo Client caching to reduce GitHub API calls and improve performance. Caching is **always enabled** for optimal performance.

### Debug Mode

Run with `GH_MANAGER_DEBUG=1` to enable debugging features:
```bash
GH_MANAGER_DEBUG=1 npx gh-manager-cli
```

Debug mode provides:
- **Apollo performance metrics**: Query execution time, cache hit/miss indicators
- **Detailed error messages**: Full GraphQL and network errors for troubleshooting
- **Data source tracking**: Shows whether data came from cache or network

### Verifying Cache is Working

1. **Performance Indicators** (visible in debug mode):
   - **From cache: YES** = Data served from cache
   - **Query time < 50ms** = Likely cache hit
   - **Network status codes** = Shows Apollo's internal cache state

2. **API Credits**: Monitor the API counter in the header - it should remain stable when navigating previously loaded data

3. **Cache Inspection**: Press `Ctrl+I` (available anytime) to see:
   - Cache file location and size
   - Recent cache entries with timestamps
   - Cache age for each query type

### Why API Credits Might Still Decrease

Even with caching enabled, API credits may decrease due to:

- **First-time requests**: Initial data must be fetched and cached
- **Cache expiration**: Default 30-minute TTL (customize with `APOLLO_TTL_MS`)
- **Pagination**: New pages beyond the cache are fetched from API
- **Cache-and-network policy**: Updates stale cache data in background
- **Sorting changes**: Different sort orders create new cache entries

### Configuration

```bash
# Number of repositories to fetch per page (1-50, default: 15)
REPOS_PER_FETCH=10 npx gh-manager-cli

# Custom cache TTL (milliseconds) - default: 30 minutes
APOLLO_TTL_MS=1800000 npx gh-manager-cli

# Enable debug mode to see cache performance
GH_MANAGER_DEBUG=1 npx gh-manager-cli

# Combine multiple environment variables
REPOS_PER_FETCH=5 GH_MANAGER_DEBUG=1 npx gh-manager-cli-cli
```

## Release Process

The project uses **automated releases** with two complementary GitHub Actions workflows:

### Automatic Semantic Releases

**Workflow**: `automated-release.yml`  
**Triggers**: Every push to `main` branch  
**Process**:

1. **Semantic Release** analyzes commit messages since the last release
2. **Version Calculation** based on [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` → Minor version (1.0.0 → 1.1.0)
   - `fix:` → Patch version (1.0.0 → 1.0.1)
   - `BREAKING CHANGE:` → Major version (1.0.0 → 2.0.0)
   - `chore:`, `docs:`, `style:`, `refactor:`, `test:` → No release
3. **Automated Actions**:
   - Updates `package.json` version
   - Generates `CHANGELOG.md`
   - Creates GitHub release with tag
   - Publishes to NPM registry
   - Publishes to GitHub Packages
   - Updates Homebrew formula in [wiiiimm/homebrew-tap](https://github.com/wiiiimm/homebrew-tap)

### Version Change Detection

**Workflow**: `release-on-version-change.yml`  
**Triggers**: When `package.json` version field changes  
**Purpose**: Backup mechanism for manual releases  
**Process**:

1. Detects version change in `package.json`
2. Verifies version doesn't exist on NPM
3. Publishes to NPM if new
4. Updates Homebrew formula with new SHA256
5. Creates GitHub release

### Writing Good Commit Messages

To trigger automatic releases, follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Features (minor version bump)
git commit -m "feat: add repository transfer functionality"
git commit -m "feat(ui): implement dark mode toggle"

# Fixes (patch version bump)
git commit -m "fix: resolve rate limit handling issue"
git commit -m "fix(api): correct pagination cursor logic"

# Breaking changes (major version bump)
git commit -m "feat!: redesign configuration format

BREAKING CHANGE: Config files from v1.x need migration"

# No release triggered
git commit -m "chore: update dependencies"
git commit -m "docs: improve README examples"
git commit -m "style: format code with prettier"
git commit -m "refactor: extract utility functions"
git commit -m "test: add unit tests for auth flow"
```

### Manual Release Process

To manually trigger a release:

```bash
# Update version using npm
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0

# Or edit package.json directly
vim package.json     # Change "version" field

# Commit and push
git add package.json
git commit -m "chore(release): 1.2.3"
git push origin main
```

The `release-on-version-change.yml` workflow will detect the change and publish to NPM and Homebrew.

### Release Destinations

Each release publishes to multiple destinations:

1. **NPM Registry** ([npmjs.com/package/gh-manager-cli](https://www.npmjs.com/package/gh-manager-cli))
   - Public package for `npm install -g gh-manager-cli`
   - Used by `npx gh-manager-cli@latest`

2. **GitHub Packages** (@wiiiimm/gh-manager-cli)
   - Alternative registry for GitHub users
   - Install with: `npm install -g @wiiiimm/gh-manager-cli`

3. **GitHub Releases** ([github.com/wiiiimm/gh-manager-cli/releases](https://github.com/wiiiimm/gh-manager-cli/releases))
   - Tagged releases with changelogs
   - Pre-built binaries for Windows, macOS, Linux

4. **Homebrew Tap** ([github.com/wiiiimm/homebrew-tap](https://github.com/wiiiimm/homebrew-tap))
   - Formula automatically updated with new version and SHA256
   - Install with: `brew install wiiiimm/tap/gh-manager-cli`

### Monitoring Releases

- **GitHub Actions**: Check [Actions tab](https://github.com/wiiiimm/gh-manager-cli/actions) for workflow status
- **NPM Versions**: Run `npm view gh-manager-cli versions` to see all published versions
- **Release Notes**: View [Releases page](https://github.com/wiiiimm/gh-manager-cli/releases) for changelogs

### Troubleshooting Releases

If a release fails:

1. **Check GitHub Actions logs** for error details
2. **Verify secrets** are configured:
   - `NPM_TOKEN` - For NPM publishing
   - `GH_TOKEN` - For Homebrew tap updates (needs repo write access)
3. **Semantic Release issues**:
   - Ensure commit messages follow conventional format
   - Check `.releaserc.json` configuration
4. **Manual intervention**:
   - Can manually publish to NPM: `npm publish`
   - Can manually update Homebrew tap PR

## Testing

For detailed information about testing, see the [Testing](Testing.md) page.

## Related Pages

- [Features](Features.md) - Core features and capabilities
- [Testing](Testing.md) - Testing documentation
- [Roadmap](Roadmap.md) - Upcoming features and enhancements

