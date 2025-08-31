# gh-manager-cli TODOs

Living roadmap and task tracker for gh-manager-cli. Use this file as the single source of truth for planned work, WIP, and completed items.

Legend:
- [ ] Todo
- [~] In progress
- [x] Done

## Now

- [x] Density toggle (row spacing)
  - Key `t` cycles: Compact (0), Cozy (1), Comfy (2) blank lines
  - Update virtualization math to reflect spacing
  - [x] Persist preference in config (and read on boot)

- [x] Persist UI preferences (s/d/t)
  - Store sort field (`s`), sort direction (`d`), and density (`t`) in config
  - Read on startup and apply to initial state; write on each toggle
  - Backward‑compatible defaults when values are missing

## Near‑Term

- [x] Repo actions with confirmations
  - [x] Archive / Unarchive repositories
    - Key mapping: `Ctrl+A` to open archive/unarchive modal
    - GraphQL mutations: `archiveRepository` and `unarchiveRepository`
    - Confirmation modal with Left/Right focus navigation and button styling
    - Update local state (`isArchived` field) after successful operation
    - Handle API errors gracefully with error messages
  - [x] Archive badge in repository list
    - Show "Archived" badge next to archived repositories in main listing
    - Use gray/dim styling to visually distinguish archived repos
  - [x] Delete (dangerous; detailed confirm flow)
    - Key trigger: `Del` or `Backspace` from the list view
    - Full-screen modal overlay with repo info (nameWithOwner, visibility, stars, forks, updatedAt)
    - Two-stage confirmation:
      - Stage 1: User types 4-character uppercase validation code (excluding 'C')
      - Stage 2: Final warning with Left/Right button focus and multiple confirm options
    - Execute delete via GitHub REST API (DELETE /repos/{owner}/{repo})
    - On success: close modal, remove repo from list, refresh totalCount
    - On failure: show error in modal with proper error handling

- [ ] Sync fork with upstream
  - Assign a key to trigger sync: e.g. `u` (Update from upstream)
  - Only show option for forked repositories that are behind upstream
  - Confirmation modal showing:
    - Fork name and upstream repository
    - Number of commits behind
    - Warning about potential conflicts
  - Execute sync via GitHub REST API (POST /repos/{owner}/{repo}/merge-upstream)
    - Requires `contents:write` scope and push permissions
    - Request body: `{ "branch": "main" }` (or current default branch)
  - On success:
    - Update local repo state to show 0 commits behind
    - Show success message with number of commits pulled
    - Close modal and refresh the repository display
  - On conflict (409 response):
    - Show error explaining manual merge needed
    - Suggest creating a pull request to resolve conflicts
  - On other failure: show error with retry option

- [ ] Rename repository
  - Assign a key to trigger rename: e.g. `E` (Edit name)
  - Modal overlay with a single-line text input prefilled with current repo name
    - User can edit or clear and retype; value cannot be empty (trimmed)
    - `Esc` cancels and closes the modal without changes
  - On submit:
    - Attempt rename via GitHub API (GraphQL mutation); validate scopes/permissions
    - Success: close modal and update the repo in local list (name and nameWithOwner); re-run local sorting if applicable; no server refetch required
    - Failure: show error message in the modal; allow retry or cancel

- [ ] Organization support
  - Switch between personal and organizations
  - List orgs (viewer.organizations) and browse their repos
  - Owner affiliation filters (OWNER, COLLABORATOR, ORGANIZATION_MEMBER)
  - Switching UI
    - Show a picker overlay listing:
      - Personal Account (@your_github_handle)
      - Organizations (name and @login)
    - Keyboard: assign `W` (Workspace/Who) to open the switcher; Up/Down to select; Enter to switch; Esc to cancel
    - Persist last-selected context and show it in header (e.g., “Repositories — Personal Account” or “Repositories — org: @acme”)
    - Apply context to repo queries (scoped owner/org), and refresh list/totalCount on switch

- [ ] Bulk selection and actions
  - Multi-select mode
    - Enter multi-select with a key (e.g., `M`)
    - Use Up/Down to navigate; Space toggles selection; `*` selects all in view; `U` unselects all
    - Show selected count in header/footer
  - Bulk operations
    - Bulk archive/unarchive selected
    - Bulk delete selected (with aggregate confirmation including per-repo list)
    - Two-step confirm for destructive operations; follow modal UX (Left/Right, Enter, Y/C)
  - Performance and UX
    - Use batched REST/GraphQL calls; display progress with spinner and per-item status
    - On success: update local list states (archived flag or removal) without full refetch
    - On failure: show summary with failed items and suggested remediation

- [ ] Infinite scroll improvements
  - Inline loading indicator at end of list
    - When user reaches end of loaded repos, show spinner/loading message inline
    - Display "Loading more repositories..." with animated spinner at bottom of list
    - Keep existing repos visible while fetching next page
  - Smarter prefetching trigger
    - Change prefetch trigger from "5 items from end" to "80% from bottom"
    - Calculate: trigger when `cursor >= Math.floor(loadedItems.length * 0.8)`
    - Prevents user from ever reaching actual end before more data loads
    - Smoother infinite scroll experience with earlier prefetching

- [ ] Server‑side search
  - Support GitHub search for repos (beyond loaded pages)
  - Integrate with `/` filter bar; show mode indicator
  - Consider Apollo Client + apollo3-cache-persist for normalized caching and persistence
    - Migrate GraphQL calls to ApolloClient with InMemoryCache
    - Persist cache to files under app data dir via custom fs storage
    - Add TTL overlay for stale-while-revalidate on startup

- [x] Sorting enhancements  
  - [x] Persist sort field + direction in config (implemented in UI preferences)
  - [ ] Additional fields (created, size)

- [ ] Smart repository data caching system
  - **Challenge**: Each sort/direction combination changes server-side ordering, requiring separate cache entries
  - **Hybrid caching approach**:
    - **Full page cache**: Cache complete sorted repository lists by `{sortKey}-{sortDir}` key
    - **Partial cache**: Cache expensive per-repo data (commits behind, etc.) by repo ID/name
  - Cache strategies to consider:
    - **Option A - Full page caching**: 
      - Pro: Simple, matches current GraphQL query structure
      - Con: Need separate cache for each sort combination (4 fields × 2 directions = 8 cache files)
      - Cache key: `repos-{sortKey}-{sortDir}-{ownerAffiliation}.json`
    - **Option B - Hybrid caching**:
      - Cache basic repo metadata (name, description, stars, etc.) in unsorted format
      - Cache expensive data (commits behind) separately by repo name/ID with longer TTL
      - Pro: More efficient for sort changes, shared expensive data across views
      - Con: Complex merge logic, may require individual queries for commit data
    - **Option C - Smart invalidation**:
      - Cache only the most recent sort combination to avoid cache explosion
      - Invalidate when user changes sort, but keep expensive per-repo data
  - Implementation considerations:
    - Full queries save more API calls but create cache explosion
    - Partial caching might require individual repo queries for commits behind (expensive)
    - Client-side sorting of cached basic data isn't possible for server-only fields (like GitHub's sort fields)
  - Recommended approach: Start with Option A (full page cache) for simplicity, monitor cache directory size

- [x] Rate‑limit improvements
  - [x] Show rate limit usage with delta changes: API: remaining/limit (+/-delta)
  - [x] Color thresholds (yellow when low)
  - [x] Toggle to show/hide "commits behind" for forks
    - Key binding: `f` to toggle fork commit tracking on/off
    - When disabled: exclude expensive commit history queries from GraphQL
    - Saves significant API rate limit usage (removes defaultBranchRef.target.history queries)
    - Show toggle state in header: "Forks: ON/OFF"
    - Persist preference in config alongside other UI settings
    - When toggled on: smart refresh to populate commit counts if data missing
    - Visual indicator: forks show "Fork of parent" without behind count when disabled
    - Show "up to date" for forks with 0 commits behind when tracking enabled

- [ ] OS keychain support
  - Optional storage via `keytar`; fallback to file with 0600 perms

- [ ] Window resize handling
  - Recompute layout on terminal resize; keep selection visible

- [ ] Copy repository URL to clipboard
  - HTTPS URL copy
    - Assign key: `H` to copy `https://github.com/<owner>/<repo>.git`
    - On success: show a short-lived footer toast (e.g., “Copied HTTPS URL”)
    - On failure: show error toast with suggestion
  - SSH URL copy
    - Assign key: `S` to copy `git@github.com:<owner>/<repo>.git`
    - On success/failure: same toasts as above
  - Cross‑platform clipboard
    - Prefer `clipboardy` dependency; fallback to OS commands: macOS `pbcopy`, Windows `clip`, Linux `xclip`/`xsel`/`wl-copy`
    - Silent no‑op if clipboard utility absent and `clipboardy` unavailable, but show error toast

- [ ] OAuth login flow (alternative to token)
  - GitHub OAuth App authentication as alternative to Personal Access Token
  - Implementation approach:
    - Register OAuth app with GitHub (client ID/secret)
    - CLI flow: open browser to GitHub OAuth authorize URL
    - Start local HTTP server to receive callback with authorization code
    - Exchange code for access token via GitHub token endpoint
    - Store token with same security as current PAT implementation
  - User experience:
    - On first run: "Login via (1) Personal Access Token or (2) GitHub OAuth"
    - OAuth flow: "Opening browser for GitHub login..." → callback → "Authentication successful!"
    - Same token storage and management as current implementation
  - Benefits: no need to manually create PATs, auto-scoping, better UX
  - Considerations: requires OAuth app registration, local server for callback

- [ ] Logout (clear stored token)
  - Assign key: `Ctrl+L` to open logout prompt
  - Confirmation modal: "Are you sure you want to log out?"
    - `Esc` or `N` = cancel
    - `Y` or `Enter` = confirm
  - On confirm:
    - Remove token from config (delete token field or whole file if only token is stored)
    - Clear in-memory token and return to the Authentication Required prompt (token bootstrap screen)
    - Show success toast (e.g., "Logged out. Token cleared.")
  - Handle errors gracefully and keep user in current state on failure

## Later

- [ ] Language filter and indicators
  - Quick language cycling; language legend in footer

- [ ] Bulk actions
  - Multi‑select and apply action to selection

- [ ] CLI flags
  - e.g. `--org`, `--sort`, `--filter`, `--page-size`

- [ ] Extended repo metadata
  - License, topics, issues count, watchers

- [ ] Testing
  - Unit tests for formatting and reducers
  - Snapshot tests for row rendering (where feasible)

- [ ] Packaging
  - Publish to npm; verify bin and shebang; versioned release notes

## Done

- [x] Token bootstrap: prompt → validate → persist (0600)
- [x] List personal repos with metadata
- [x] Infinite scroll with page prefetch and dynamic totalCount
- [x] Client‑side filter (`/`)
- [x] Sorting toggles (`s` field, `d` direction) with server-side refresh
- [x] Open selected repo in browser (Enter / `o`)
- [x] Rate‑limit indicator (remaining/limit) with delta changes
- [x] Row spacing via Box height with virtualization fix
- [x] Environment-based page sizes (development: 15, production: 25)
- [x] Dotenv loading for development configuration
- [x] Fork commit tracking toggle ('f' key) with smart refresh
- [x] Fork status display: "Fork of upstream" with commits behind/up to date
- [x] Archive/unarchive repositories with confirmation modals
- [x] Delete repositories with two-stage confirmation and REST API
- [x] Archive status badges in repository listings
- [x] UI preference persistence (sort, density, fork tracking)
- [x] Repository deletion via REST API (GraphQL unsupported)
- [x] Modal focus navigation and keyboard shortcuts
- [x] Smart loading states for sort changes and refreshes
- [x] Comprehensive feature documentation added to README
- [x] Repository sync with upstream planning (REST API research completed)
- [x] OAuth login alternative research and planning
- [x] Version display planning (next to app title)
