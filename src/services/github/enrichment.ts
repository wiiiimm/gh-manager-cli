import { logger } from '../../lib/logger';
import { makeClient, toError } from './client';

// Dynamic alias keys produced by enrichForksWithAheadBehind (fork0, parent0, …)
type EnrichForksResponse = Record<string, {
  id?: string;
  defaultBranchRef?: {
    target?: {
      history?: { totalCount: number };
    };
  };
} | null>;

export interface ForkEnrichment {
  id: string;
  forkHistoryCount: number | null;
  parentHistoryCount: number | null;
}

// Batch-enrich forks with ahead/behind counts using aliased node(id:) + repository(owner,name) queries.
// Batch size is capped at 5 forks (10 history queries) to stay well within GitHub's per-query budget.
export async function enrichForksWithAheadBehind(
  client: ReturnType<typeof makeClient>,
  forks: Array<{ id: string; parentNameWithOwner: string }>
): Promise<ForkEnrichment[]> {
  if (forks.length === 0) return [];

  const results: ForkEnrichment[] = [];
  const BATCH_SIZE = 5;

  for (let batchStart = 0; batchStart < forks.length; batchStart += BATCH_SIZE) {
    const batch = forks.slice(batchStart, batchStart + BATCH_SIZE);

    const queryParts: string[] = [];
    const variables: Record<string, string> = {};

    batch.forEach((fork, i) => {
      const [parentOwner, parentName] = fork.parentNameWithOwner.split('/');
      if (!parentOwner || !parentName) return;

      const varName = `fid${i}`;
      variables[varName] = fork.id;

      // Sanitise owner/name: only alphanumeric, hyphens, dots and underscores are valid
      const safeOwner = parentOwner.replace(/[^a-zA-Z0-9_.\-]/g, '');
      const safeName = parentName.replace(/[^a-zA-Z0-9_.\-]/g, '');

      queryParts.push(`
        fork${i}: node(id: $${varName}) {
          ... on Repository {
            id
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 0) { totalCount }
                }
              }
            }
          }
        }
        parent${i}: repository(owner: "${safeOwner}", name: "${safeName}") {
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 0) { totalCount }
              }
            }
          }
        }
      `);
    });

    if (queryParts.length === 0) {
      // Every fork in this batch had an unparseable parent (no owner/name) —
      // emit null rows so the function always returns exactly one entry per
      // input fork, keeping the result contract complete for callers.
      batch.forEach(fork => results.push({ id: fork.id, forkHistoryCount: null, parentHistoryCount: null }));
      continue;
    }

    const varDefs = Object.entries(variables)
      .map(([k]) => `$${k}: ID!`)
      .join(', ');

    const query = `query EnrichForks(${varDefs}) { ${queryParts.join('\n')} }`;

    try {
      const res = await client<EnrichForksResponse>(query, variables);

      batch.forEach((fork, i) => {
        const forkNode = res[`fork${i}`];
        const parentNode = res[`parent${i}`];

        const forkHistoryCount: number | null =
          forkNode?.defaultBranchRef?.target?.history?.totalCount ?? null;
        const parentHistoryCount: number | null =
          parentNode?.defaultBranchRef?.target?.history?.totalCount ?? null;

        results.push({ id: fork.id, forkHistoryCount, parentHistoryCount });
      });
    } catch (err: unknown) {
      const e = toError(err);
      logger.error('enrichForksWithAheadBehind batch failed', {
        error: e.message,
        batchSize: batch.length,
      });
      // Push nulls for this batch so callers know they weren't enriched
      batch.forEach(fork => results.push({ id: fork.id, forkHistoryCount: null, parentHistoryCount: null }));
    }
  }

  return results;
}
