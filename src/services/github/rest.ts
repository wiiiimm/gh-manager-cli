import type { RestRateLimitInfo } from '../../types';
import { logger } from '../../lib/logger';
import { toError } from './client';

// Minimal shapes for the GitHub REST JSON bodies we parse. `Response.json()` is
// typed as `Promise<unknown>` (undici), so these let us narrow without `any`.
interface GitHubRestErrorBody {
  message?: string;
  errors?: Array<{ message?: string; field?: string; code?: string }>;
}

interface CreateRepoRestResponse {
  full_name: string;
  html_url: string;
}

interface SyncForkRestResponse {
  message: string;
  merge_type: string;
  base_branch: string;
}

interface RestRateLimitResource {
  limit: number;
  remaining: number;
  reset: number;
}

interface RestRateLimitResponse {
  resources?: {
    core?: RestRateLimitResource;
    graphql?: RestRateLimitResource;
  };
}

// GitHub GraphQL does not support deleting repos. Use REST: DELETE /repos/{owner}/{repo}
export async function deleteRepositoryRest(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  logger.info('Deleting repository', {
    owner,
    repo,
    url
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'gh-manager-cli'
      }
    });
  } catch (networkError: unknown) {
    const err = toError(networkError);
    logger.error('Network error during repository deletion', { error: err.message, owner, repo });
    throw new Error(`Network error whilst deleting repository: ${err.message}`);
  }

  if (res.status === 204) {
    logger.info('Successfully deleted repository', {
      owner,
      repo,
      status: res.status
    });
    return; // No Content = success
  }

  let msg = `GitHub REST delete failed (status ${res.status})`;
  try {
    const body = await res.json() as GitHubRestErrorBody;
    if (body && body.message) msg += `: ${body.message}`;
  } catch {
    // ignore
  }

  logger.error('Failed to delete repository', {
    status: res.status,
    error: msg,
    owner,
    repo
  });

  throw new Error(msg);
}

// GitHub GraphQL does not support creating repos. Use REST:
//   - Personal: POST /user/repos
//   - Organisation: POST /orgs/{org}/repos
/**
 * Parse a failed GitHub REST response into a human-readable error message,
 * combining the top-level `message` with any per-field `errors[]` details.
 *
 * @param res The non-OK fetch Response.
 * @param defaultMessage Fallback message used when the body can't be parsed.
 */
async function parseGitHubRestError(res: Response, defaultMessage: string): Promise<string> {
  let msg = defaultMessage;
  try {
    const errBody = await res.json() as GitHubRestErrorBody;
    if (errBody?.message) msg = errBody.message;
    if (Array.isArray(errBody?.errors) && errBody.errors.length > 0) {
      const details = errBody.errors
        .map((e) => e.message || (e.field ? `${e.field}: ${e.code}` : e.code))
        .filter(Boolean)
        .join('; ');
      if (details) msg += ` (${details})`;
    }
  } catch {
    // ignore body parse errors
  }
  return msg;
}

/** Options describing the repository to create via {@link createRepositoryRest}. */
export interface CreateRepositoryOptions {
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
  description?: string;
  org?: string; // when provided, create under the organisation instead of the viewer
}

/**
 * Create a repository via the GitHub REST API.
 *
 * Posts to `/user/repos` for the viewer, or `/orgs/{org}/repos` when `options.org`
 * is set. Maps the requested visibility to the REST body (`private` boolean, or
 * `visibility: 'internal'` for enterprise organisations).
 *
 * @param token GitHub access token with repo-creation scope.
 * @param options The new repository's name, visibility, optional description and org.
 * @returns The created repository's `nameWithOwner` and web `url`.
 * @throws Error with a GitHub-derived message on a non-201 response or network failure.
 */
export async function createRepositoryRest(
  token: string,
  options: CreateRepositoryOptions
): Promise<{ nameWithOwner: string; url: string }> {
  const { name, visibility, description, org } = options;
  const url = org
    ? `https://api.github.com/orgs/${org}/repos`
    : `https://api.github.com/user/repos`;

  const body: Record<string, unknown> = { name };
  if (visibility === 'INTERNAL') {
    // Internal visibility is only valid for org repos within an enterprise
    body.visibility = 'internal';
  } else {
    body.private = visibility === 'PRIVATE';
  }
  if (description) body.description = description;

  logger.info('Creating repository', { name, visibility, org: org ?? null, url });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'gh-manager-cli'
      },
      body: JSON.stringify(body)
    });
  } catch (networkError: unknown) {
    const err = toError(networkError);
    logger.error('Network error during repository creation', { error: err.message, name, org: org ?? null });
    throw new Error(`Network error whilst creating repository: ${err.message}`);
  }

  if (res.status === 201) {
    const data = await res.json() as CreateRepoRestResponse;
    logger.info('Successfully created repository', {
      nameWithOwner: data.full_name,
      url: data.html_url
    });
    return { nameWithOwner: data.full_name, url: data.html_url };
  }

  const msg = await parseGitHubRestError(res, `Failed to create repository (status ${res.status})`);

  logger.error('Failed to create repository', { status: res.status, error: msg, name, org: org ?? null });
  throw new Error(msg);
}

// GitHub GraphQL does not support transferring repos. Use REST:
//   POST /repos/{owner}/{repo}/transfer with { new_owner }
// The transfer is asynchronous: GitHub returns 202 Accepted on success.
/**
 * Transfer a repository to another owner via the GitHub REST API.
 *
 * The transfer is asynchronous — GitHub returns `202 Accepted` to acknowledge the
 * request and processes it in the background, so success here means *initiated*,
 * not completed.
 *
 * @param token GitHub access token with admin rights on the repository.
 * @param owner Current owner (user or organisation) of the repository.
 * @param repo Repository name.
 * @param newOwner Destination owner (username or organisation login).
 * @throws Error with a GitHub-derived message on a non-202/200 response or network failure.
 */
export async function transferRepositoryRest(
  token: string,
  owner: string,
  repo: string,
  newOwner: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/transfer`;

  logger.info('Transferring repository', { owner, repo, newOwner, url });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'gh-manager-cli'
      },
      body: JSON.stringify({ new_owner: newOwner })
    });
  } catch (networkError: unknown) {
    const err = toError(networkError);
    logger.error('Network error during repository transfer', { error: err.message, owner, repo, newOwner });
    throw new Error(`Network error whilst transferring repository: ${err.message}`);
  }

  // 202 Accepted = transfer initiated. Some responses may also return 200.
  if (res.status === 202 || res.status === 200) {
    logger.info('Successfully initiated repository transfer', { owner, repo, newOwner, status: res.status });
    return;
  }

  const msg = await parseGitHubRestError(res, `Failed to transfer repository (status ${res.status})`);

  logger.error('Failed to transfer repository', { status: res.status, error: msg, owner, repo, newOwner });
  throw new Error(msg);
}

export async function syncForkWithUpstream(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<{ message: string; merge_type: string; base_branch: string }> {
  const url = `https://api.github.com/repos/${owner}/${repo}/merge-upstream`;

  logger.info('Syncing fork with upstream', {
    owner,
    repo,
    branch,
    url
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'gh-manager-cli'
      },
      body: JSON.stringify({ branch })
    });
  } catch (networkError: unknown) {
    const err = toError(networkError);
    logger.error('Network error during fork sync', { error: err.message, owner, repo, branch });
    throw new Error(`Network error whilst syncing fork: ${err.message}`);
  }

  if (res.status === 204) {
    // Already up to date
    logger.info('Fork already up-to-date with upstream', {
      owner,
      repo,
      branch,
      status: res.status
    });
    return { message: 'Already up-to-date', merge_type: 'none', base_branch: branch };
  }

  if (res.status === 200) {
    const body = await res.json() as SyncForkRestResponse;
    logger.info('Successfully synced fork with upstream', {
      owner,
      repo,
      branch,
      status: res.status,
      mergeType: body.merge_type,
      message: body.message
    });
    return body;
  }

  let msg = `Fork sync failed (status ${res.status})`;
  try {
    const body = await res.json() as GitHubRestErrorBody;
    if (body && body.message) {
      msg += `: ${body.message}`;
      if (res.status === 409) {
        msg += ' (conflicts detected - manual merge required)';
      }
      if (res.status === 422) {
        msg += ' (branch could not be synced)';
      }
    }
  } catch {
    // ignore
  }

  logger.error('Failed to sync fork with upstream', {
    status: res.status,
    error: msg,
    owner,
    repo,
    branch
  });

  throw new Error(msg);
}

// Fetch REST API rate limits
export async function fetchRestRateLimits(token: string): Promise<RestRateLimitInfo | null> {
  try {
    logger.debug('Fetching REST API rate limits');

    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'gh-manager-cli'
      }
    });

    if (!response.ok) {
      logger.error('Failed to fetch REST rate limits', {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const data = await response.json() as RestRateLimitResponse;

    logger.debug('Successfully fetched REST rate limits', {
      core: data.resources?.core,
      graphql: data.resources?.graphql
    });

    return {
      core: data.resources?.core || { limit: 0, remaining: 0, reset: 0 },
      graphql: data.resources?.graphql || { limit: 0, remaining: 0, reset: 0 }
    };
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Error fetching REST rate limits', {
      error: err.message,
      stack: err.stack
    });
    return null;
  }
}
