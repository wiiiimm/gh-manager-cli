# Apollo Cache (Performance)

gh-manager-cli includes built-in Apollo Client caching to reduce GitHub API calls and improve performance. Caching is **always enabled** for optimal performance.

## Debug Mode

Run with `GH_MANAGER_DEBUG=1` to enable debugging features:

```bash
GH_MANAGER_DEBUG=1 npx gh-manager-cli@latest
```

Debug mode provides:

- **Apollo performance metrics:** query execution time and cache hit/miss indicators.
- **Detailed error messages:** full GraphQL and network errors.
- **Data source tracking:** whether data came from cache or network.

## Verifying Cache is Working

1. **Performance indicators** (visible in debug mode):
   - **From cache: YES** = served from cache.
   - **Query time < 50ms** = likely a cache hit.
   - **Network status codes** show Apollo's internal cache state.
2. **API credits:** monitor the API counter in the header; it should remain stable when navigating previously loaded data.
3. **Cache inspection:** press `K` (anytime) to see the cache file location and size, recent cache entries with timestamps, and the cache age for each query type.

## Why API Credits Might Still Decrease

Even with caching enabled, API credits may decrease due to:

- **First-time requests:** initial data must be fetched and cached.
- **Cache expiration:** default 30-minute TTL (customise with `APOLLO_TTL_MS`).
- **Pagination:** new pages beyond the cache are fetched from the API.
- **Cache-and-network policy:** updates stale cache in the background.
- **Sorting changes:** different sort orders create new cache entries.

## Configuration

```bash
# Number of repositories to fetch per page (1-100, default: 100)
REPOS_PER_FETCH=10 npx gh-manager-cli@latest

# Custom cache TTL (milliseconds) - default: 30 minutes
APOLLO_TTL_MS=1800000 npx gh-manager-cli@latest

# Enable debug mode to see cache performance
GH_MANAGER_DEBUG=1 npx gh-manager-cli@latest

# Combine multiple environment variables
REPOS_PER_FETCH=5 GH_MANAGER_DEBUG=1 npx gh-manager-cli@latest
```

## Related Pages

- [Development](Development.md) — developer setup, scripts, and environment variables
- [Logging](Logging.md) — log locations and what is recorded
- [Troubleshooting](Troubleshooting.md) — diagnosing common issues
