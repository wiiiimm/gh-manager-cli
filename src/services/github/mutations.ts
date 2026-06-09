import { logger } from '../../lib/logger';
import { makeClient, toError } from './client';

// Star a repository
export async function starRepository(
  client: ReturnType<typeof makeClient>,
  starrableId: string
): Promise<void> {
  logger.info('Starring repository', {
    starrableId
  });

  const mutation = /* GraphQL */ `
    mutation StarRepo($starrableId: ID!) {
      addStar(input: { starrableId: $starrableId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { starrableId });
    logger.info('Successfully starred repository', {
      starrableId
    });
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to star repository', {
      starrableId,
      error: err.message,
      stack: err.stack
    });
    throw error;
  }
}

// Unstar a repository
export async function unstarRepository(
  client: ReturnType<typeof makeClient>,
  starrableId: string
): Promise<void> {
  logger.info('Unstarring repository', {
    starrableId
  });

  const mutation = /* GraphQL */ `
    mutation UnstarRepo($starrableId: ID!) {
      removeStar(input: { starrableId: $starrableId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { starrableId });
    logger.info('Successfully unstarred repository', {
      starrableId
    });
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to unstar repository', {
      starrableId,
      error: err.message,
      stack: err.stack
    });
    throw error;
  }
}

export async function archiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  logger.info('Archiving repository', {
    repositoryId
  });

  const mutation = /* GraphQL */ `
    mutation ArchiveRepo($repositoryId: ID!) {
      archiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { repositoryId });
    logger.info('Successfully archived repository', {
      repositoryId
    });
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to archive repository', {
      repositoryId,
      error: err.message,
      stack: err.stack
    });
    throw error;
  }
}

export async function unarchiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  logger.info('Unarchiving repository', {
    repositoryId
  });

  const mutation = /* GraphQL */ `
    mutation UnarchiveRepo($repositoryId: ID!) {
      unarchiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { repositoryId });
    logger.info('Successfully unarchived repository', {
      repositoryId
    });
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to unarchive repository', {
      repositoryId,
      error: err.message,
      stack: err.stack
    });
    throw error;
  }
}

export async function changeRepositoryVisibility(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL',
  token: string
): Promise<{ nameWithOwner: string }> {
  // First, get the repository details to get the owner and name
  const query = /* GraphQL */ `
    query GetRepoDetails($id: ID!) {
      node(id: $id) {
        ... on Repository {
          nameWithOwner
          owner {
            login
          }
          name
        }
      }
    }
  `;

  // Wrap the GraphQL lookup + REST PATCH so transport/client errors get the
  // same unknown-narrowing + logging treatment as the other mutations, rather
  // than escaping raw. Deliberate throws below ('Repository not found',
  // 'Failed to change visibility: …') keep their exact messages — the catch
  // logs once and rethrows, so the modal still surfaces the same text.
  try {
    const result = await client<{ node?: { nameWithOwner?: string } | null }>(query, { id: repositoryId });
    const repo = result.node;

    if (!repo || !repo.nameWithOwner) {
      throw new Error('Repository not found');
    }

    const [owner, name] = repo.nameWithOwner.split('/');

    // Use REST API to change visibility since GraphQL doesn't support it
    // Use the visibility field directly (supports public, private, internal)
    const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'gh-manager-cli'
      },
      body: JSON.stringify({
        visibility: visibility.toLowerCase() // API expects lowercase
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to change visibility: ${error}`);
    }

    logger.info('Successfully changed repository visibility', {
      owner,
      name,
      newVisibility: visibility,
      nameWithOwner: repo.nameWithOwner
    });

    return { nameWithOwner: repo.nameWithOwner };
  } catch (error: unknown) {
    const err = toError(error);
    // 'Repository not found' is an expected caller condition (the node lookup
    // returned nothing), not an operational failure — don't log it as an error.
    // This preserves the pre-refactor behaviour, where that case threw without
    // logging, while still logging genuine GraphQL/REST/network failures.
    if (err.message !== 'Repository not found') {
      logger.error('Failed to change repository visibility', {
        repositoryId,
        visibility,
        error: err.message,
        stack: err.stack
      });
    }
    // Re-throw the original value (consistent with the other mutations), not the
    // toError-wrapped copy; they're the same Error in practice for octokit.
    throw error;
  }
}

export async function renameRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  newName: string
): Promise<void> {
  logger.info('Renaming repository', {
    repositoryId,
    newName
  });

  const mutation = /* GraphQL */ `
    mutation RenameRepo($repositoryId: ID!, $name: String!) {
      updateRepository(input: { repositoryId: $repositoryId, name: $name }) {
        repository {
          id
          name
          nameWithOwner
        }
      }
    }
  `;

  try {
    const result = await client<{ updateRepository?: { repository?: { name?: string } } }>(mutation, { repositoryId, name: newName });

    logger.info('Repository renamed successfully', {
      repositoryId,
      newName: result?.updateRepository?.repository?.name
    });
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to rename repository', {
      repositoryId,
      newName,
      error: err.message,
      stack: err.stack
    });
    throw error;
  }
}
