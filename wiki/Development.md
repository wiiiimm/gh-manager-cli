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

## Testing

For detailed information about testing, see the [Testing](Testing.md) page.

## Related Pages

- [Features](Features.md) - Core features and capabilities
- [Testing](Testing.md) - Testing documentation
- [Roadmap](Roadmap.md) - Upcoming features and enhancements

