import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { RepoNode } from '../../types';
import { enrichForksWithAheadBehind, makeClient } from '../../services/github';
import { logger } from '../../lib/logger';

/**
 * Fork ahead/behind enrichment (SWR-362), extracted from RepoList (GMC-28).
 *
 * After the owned list is fully loaded, this batches aliased GraphQL queries
 * (5 forks/batch, 200ms apart) to fetch each fork's and its parent's commit
 * counts, then merges them back into `items`. Behaviour-preserving move of the
 * inline effect — same guards, cancellation semantics, dependency array and
 * "mark even failed lookups as done" behaviour.
 *
 * @returns `enrichingForks` (UI in-flight flag) and `resetEnrichment` (clears
 * the processed-id tracker so a fresh list load re-enriches against new data).
 */
export function useForkEnrichment(params: {
  client: ReturnType<typeof makeClient>;
  items: RepoNode[];
  setItems: React.Dispatch<React.SetStateAction<RepoNode[]>>;
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  forkTracking: boolean;
}): { enrichingForks: boolean; resetEnrichment: () => void } {
  const { client, items, setItems, loading, loadingMore, hasNextPage, forkTracking } = params;

  const [enrichingForks, setEnrichingForks] = useState(false);
  const enrichmentDoneRef = useRef<Set<string>>(new Set()); // ids already enriched

  // Fork ahead/behind enrichment: runs after the full list is loaded.
  // Uses batched aliased GraphQL queries (5 forks/batch) to stay within per-query budget.
  useEffect(() => {
    // Only run when the owned list is fully loaded and we have forks to enrich
    if (loading || loadingMore || hasNextPage || items.length === 0) return;
    if (!forkTracking) return;

    const unenriched = items.filter(r =>
      r.isFork &&
      r.parent?.nameWithOwner &&
      !enrichmentDoneRef.current.has(r.id) &&
      !(r.defaultBranchRef?.target?.history && r.parent?.defaultBranchRef?.target?.history)
    );

    if (unenriched.length === 0) return;
    // No re-entrancy guard on `enrichingForks` here: React always runs the
    // cleanup (setting `cancelled`) before re-running this effect, so two
    // un-cancelled passes can never overlap. Gating on the UI flag was what
    // left it stuck `true` after a torn-down pass.

    let cancelled = false;
    setEnrichingForks(true);

    ;(async () => {
      const BATCH_DELAY_MS = 200;

      try {
        const BATCH_SIZE = 5;
        for (let i = 0; i < unenriched.length; i += BATCH_SIZE) {
          if (cancelled) break;
          const slice = unenriched.slice(i, i + BATCH_SIZE);
          const batch = slice.map(r => ({
            id: r.id,
            parentNameWithOwner: r.parent!.nameWithOwner,
          }));

          const enriched = await enrichForksWithAheadBehind(client, batch);

          if (cancelled) break;

          // Mark every fork in the batch as processed — even ones that came
          // back with null/missing counts — so a failed lookup isn't retried
          // forever (the effect would otherwise re-fire on the next items
          // change with these still "unenriched").
          slice.forEach(r => enrichmentDoneRef.current.add(r.id));

          // Merge history counts back into items
          setItems(prev => prev.map(repo => {
            const hit = enriched.find(e => e.id === repo.id);
            if (!hit || hit.forkHistoryCount === null || hit.parentHistoryCount === null) return repo;

            return {
              ...repo,
              defaultBranchRef: repo.defaultBranchRef ? {
                ...repo.defaultBranchRef,
                target: {
                  ...(repo.defaultBranchRef.target || {}),
                  history: { totalCount: hit.forkHistoryCount! },
                },
              } : { name: undefined, target: { history: { totalCount: hit.forkHistoryCount! } } },
              parent: repo.parent ? {
                ...repo.parent,
                defaultBranchRef: {
                  ...(repo.parent.defaultBranchRef || {}),
                  target: {
                    ...(repo.parent.defaultBranchRef?.target || {}),
                    history: { totalCount: hit.parentHistoryCount! },
                  },
                },
              } : repo.parent,
            };
          }));

          // Small delay between batches to avoid rate-limit pressure
          if (i + BATCH_SIZE < unenriched.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }
      } catch (err: unknown) {
        logger.error('Fork enrichment failed', { error: err instanceof Error ? err.message : String(err) });
      } finally {
        // Only clear when this pass wasn't torn down; a cancelled pass has the
        // flag reset by the cleanup below so it can never stick `true`.
        if (!cancelled) setEnrichingForks(false);
      }
    })();

    return () => { cancelled = true; setEnrichingForks(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasNextPage, items.length, forkTracking]);

  const resetEnrichment = () => { enrichmentDoneRef.current.clear(); };

  return { enrichingForks, resetEnrichment };
}
