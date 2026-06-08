/**
 * GitHub service barrel.
 *
 * The implementation is split into focused modules (GMC-28). This barrel
 * re-exports the full public surface so existing imports from
 * `services/github` keep working unchanged:
 *
 * - `client`     — Octokit + persisted Apollo client setup (shared singleton)
 * - `queries`    — read queries + RepoNode normalisation
 * - `mutations`  — repo write operations (star, archive, visibility, rename)
 * - `rest`       — REST-only operations (delete, create, transfer, sync, rate limits)
 * - `cache`      — Apollo cache reads/updates/eviction + cache file inspection
 * - `enrichment` — batched fork ahead/behind enrichment
 */
export * from './client';
export * from './queries';
export * from './mutations';
export * from './rest';
export * from './cache';
export * from './enrichment';
