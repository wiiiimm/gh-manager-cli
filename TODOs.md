# gh-manager-cli TODOs

Living roadmap and task tracker for gh-manager-cli. Use this file as the single source of truth for planned work, WIP, and completed items.

Legend:
- [ ] Todo
- [~] In progress
- [x] Done

## Now

- [x] Code refactoring (completed)
  - [x] Extract modal components to separate files
  - [x] Organize components in structured directories
  - [x] Create reusable utility functions
  - [x] Improve component separation of concerns
  - Components extracted:
    - `src/ui/components/modals/` - All modal dialogs
    - `src/ui/components/repo/` - Repository list components  
    - `src/ui/components/common/` - Shared UI elements
    - `src/utils.ts` - Utility functions

- [x] Density toggle (row spacing)
  - Key `t` cycles: Compact (0), Cozy (1), Comfy (2) blank lines
  - Update virtualization math to reflect spacing
  - [x] Persist preference in config (and read on boot)

- [x] Persist UI preferences (s/d/t)
  - Store sort field (`s`), sort direction (`d`), and density (`t`) in config
  - Read on startup and apply to initial state; write on each toggle
  - Backward‑compatible defaults when values are missing

## Near‑Term

- [x] Change repository visibility
  - Assigned key: `Ctrl+V` to open visibility change modal ✓
  - Modal shows available visibility options (Public, Private, Internal for enterprise) ✓
  - Fork repositories show explanation that visibility cannot be changed ✓
  - Confirmation modal with Left/Right button navigation ✓
  - Execute via GitHub REST API (PATCH /repos/{owner}/{repo}) ✓
  - Updates local cache and respects active visibility filter ✓
  - Removes repo from view if new visibility doesn't match filter ✓
  - Error handling with retry option ✓

- [x] Enterprise GitHub support
  - Detection of enterprise organizations using `enterpriseOwners` GraphQL field ✓
  - ENT badge shown in header and organization switcher ✓
  - Support for INTERNAL repository visibility ✓
  - Internal repos show with magenta "Internal" badge ✓
  - Visibility filter shows "Private/Internal" for enterprise orgs ✓
  - Change visibility modal includes Internal option for enterprise ✓
  - Proper handling of GitHub API limitations with INTERNAL visibility ✓

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

- [x] Sync fork with upstream
  - Assigned key `Ctrl+S` to trigger sync
  - Only shown for forked repositories that are behind upstream
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

- [x] Rename repository
  - Assigned key `Ctrl+R` to trigger rename modal
  - Modal overlay with text input prefilled with current repo name
  - Real-time validation: name cannot be empty, must match GitHub naming rules
  - GraphQL mutation `renameRepository` with automatic Apollo cache update
  - Success: updates local state and cache without server refetch
  - Error handling with retry option and clear error messages
  - Cache update also refreshes nameWithOwner field

- [~] Add automated test suite
  - [x] Test infrastructure setup (Vitest with TypeScript support)
  - [x] Added `pnpm test` script for running tests
  - [ ] Integrate into CI (GitHub Actions)
  
  **Unit Tests:**
  - [x] `utils.ts` - truncate and formatDate functions (13 tests)
  - [x] `apolloMeta.ts` - cache key generation and TTL logic (2 tests)
  - [x] `config.ts` - configuration loading and saving (23 tests)
  - [x] `github.ts` - API interaction helpers (8 tests)
  - [ ] State management and reducers in RepoList
  
  **Component Tests:**
  - [x] `RepoRow` - Basic rendering test (1 test) - Updated spacing logic tested
  - [x] `DeleteModal` - Logic tests for verification code (4 tests)
  - [x] `RepoListHeader` - Header rendering and stats display (8 tests)
  - [x] `RepoListHeaderVisibility` - Visibility filter display tests (new test file)
  - [x] `FilterInput` - Input handling and filter logic (6 tests - mocked TextInput)
  - [x] `SlowSpinner` - Animation component (5 tests)
  - [x] `ArchiveModal` - Archive/unarchive confirmation flow (6 tests - mocked useInput)
  - [~] `SyncModal` - Fork sync confirmation flow (not implemented)
  - [x] `LogoutModal` - Logout confirmation flow (6 tests - mocked useInput)
  - [~] `InfoModal` - Repository information display (not implemented)
  - [ ] `SortModal` - Sort selection modal (needs tests)
  - [ ] `VisibilityModal` - Visibility filter modal (needs tests)
  - [ ] `RepoList` - Main component integration tests
  - [ ] `OrgSwitcher` - Organization switching logic
  
  **Integration Tests:**
  - [ ] Modal flow tests with simulated keyboard input (limited by testing framework)
  - [ ] Infinite scroll behavior
  - [ ] Search functionality
  - [ ] Sorting and filtering combinations
  - [ ] Rate limit handling
  
  **Current Progress:**
  - Total test files: 12 (added RepoListHeaderVisibility.test.tsx)
  - Total tests passing: 82+
  - Components with tests: 8/13 (62%) - Added 2 new modals needing tests
  - Utilities with tests: 4/4 (100%)
  
  **Testing Approach for useInput Components:**
  Successfully implemented mocking strategy for components using `useInput` hook:
  - Mock the `ink` module's `useInput` function directly
  - Use dynamic imports to avoid ESM/CommonJS issues
  - Test rendering and basic UI display
  - Note: Interactive keyboard behavior tests are limited but UI rendering tests work well

- [x] Organization support
  - Switch between personal and organizations
  - List orgs (viewer.organizations) and browse their repos
  - Owner affiliation filters (OWNER, COLLABORATOR, ORGANIZATION_MEMBER)
  - Switching UI
    - Show a picker overlay listing:
      - Personal Account (@your_github_handle)
      - Organizations (name and @login)
    - Keyboard: assign `W` (Workspace/Who) to open the switcher; Up/Down to select; Enter to switch; Esc to cancel
    - Persist last-selected context and show it in header (e.g., "Repositories — Personal Account" or "Repositories — org: @acme")
    - Apply context to repo queries (scoped owner/org), and refresh list/totalCount on switch
  - Implemented features:
    - OrgSwitcher component with organization listing
    - Context persistence in UI preferences
    - Dynamic GraphQL queries for personal vs org repositories
    - Header displays current context (org/@user or @user)
    - Automatic affiliation switching (OWNER for personal, ORGANIZATION_MEMBER for orgs)

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

- [x] Infinite scroll improvements
  - [x] Inline loading indicator at end of list
    - When user reaches end of loaded repos, show spinner/loading message inline
    - Display "Loading more repositories..." with animated spinner at bottom of list
    - Keep existing repos visible while fetching next page
  - [x] Smarter prefetching trigger
    - Changed prefetch trigger from "5 items from end" to "80% from bottom"
    - Calculates: trigger when `cursor >= Math.floor(loadedItems.length * 0.8)`
    - Prevents user from ever reaching actual end before more data loads
    - Smoother infinite scroll experience with earlier prefetching
    - Added debug messages to track when prefetching occurs

- [x] Footer reorganization and UI improvements
  - [x] Reorganized footer into 3 logical lines for better organization
    - Line 1: Navigation controls (Refresh, Org Switch, Logout, Quit)
    - Line 2: View/Filter controls (Top, Bottom, Search, Sort, Direction, Density, Fork Status, Visibility)
    - Line 3: Repository actions (Info, Cache Info, Archive, Delete, Sync Fork)
  - [x] Updated Delete key binding to Del/Backspace (no Ctrl required)
  - [x] Renamed "Forks - Commits Behind" to "Fork Status - Commits Behind"
  - [x] Balanced repository item spacing (1 line above, 1 line below)

- [x] Server‑side search  
  - Support GitHub search for repos (beyond loaded pages) ✓
  - Integrate with `/` filter bar; show mode indicator ✓
  - Implemented Apollo Client + apollo3-cache-persist for normalized caching and persistence ✓
    - Migrated GraphQL calls to ApolloClient with InMemoryCache ✓
    - Persist cache to files under app data dir via custom fs storage ✓
    - Added TTL overlay for stale-while-revalidate on startup ✓
  - Search requires 3+ characters to trigger server-side query ✓
  - ESC key clears search and returns to normal listing ✓
  - Down arrow from search input acts like Enter to start browsing results ✓
  - No auto-selection of first result - user must explicitly navigate ✓
  - Organization context support: uses `org:` prefix for org searches ✓
  - Label changed from "Filter:" to "Search:" for clarity ✓

- [x] Sorting enhancements  
  - [x] Persist sort field + direction in config (implemented in UI preferences)
  - [x] Sort modal interface with descriptive options (updated, pushed, name, stars)
  - [ ] Additional fields (created, size)

- [x] Packaging for Homebrew (completed via custom tap)
  - Formula name: `gh-manager-cli` ✓
  - Published to custom tap: `wiiiimm/tap` ✓
  - Install command: `brew tap wiiiimm/tap && brew install gh-manager-cli` ✓
  - Install strategy: uses npm tarball from registry ✓
  - Dependencies: `node` requirement specified ✓
  - Binary properly symlinked and executable ✓
  - Version flag implemented for testing ✓
  - SHA256 verification in formula ✓
  - Successfully tested on macOS ARM and Intel ✓
  - Note: Using custom tap instead of homebrew-core for easier maintenance

- [x] Smart repository data caching system (implemented with Apollo Client)
  - Implemented with Apollo Client and apollo3-cache-persist ✓
  - Normalized cache with InMemoryCache for automatic deduplication ✓
  - Persistent cache stored in `apollo-cache.json` file ✓
  - Cache key generation for different query combinations ✓
  - TTL-based cache invalidation with 30-minute default ✓
  - Smart cache policies: cache-first, network-only, cache-and-network ✓
  - Cache inspection with `K` key showing size and recent entries ✓
  - Cache purging on refresh (`R` key) for fresh data ✓
  - Debug mode (`GH_MANAGER_DEBUG=1`) shows cache hit/miss metrics ✓
  - Efficient caching across sort/filter combinations ✓

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


- [x] Window resize handling
  - Terminal width detection via `useStdout().columns`
  - Dynamic width adjustment for modals and repo rows
  - Responsive layout that adapts to terminal size
  - Implemented in App.tsx with resize event listener

- [x] Copy repository URL to clipboard
  - Assigned key `C` to open copy URL modal
  - Modal UI with SSH and HTTPS options
  - Left/Right arrow keys for button navigation
  - Keyboard shortcuts: `S` for SSH, `H` for HTTPS
  - Cross-platform clipboard support using `clipboardy`
  - Fallback to OS commands (pbcopy, clip, xclip/xsel/wl-copy)
  - Success/error toast messages with clear feedback

- [x] OAuth login flow (alternative to token) ✓ COMPLETED
  - GitHub OAuth App authentication as alternative to Personal Access Token ✓
  - Implementation details:
    - Uses GitHub Device Authorization Grant flow (no client secret needed) ✓
    - Client ID: Ov23li1pOAO5GZmxBF1L ✓
    - Device code displayed prominently in yellow box during auth ✓
    - Auto-opens browser to GitHub's device authorization page ✓
    - Polls for token after user authorizes (5-second intervals) ✓
    - Stores OAuth token with same 0600 permissions as PAT ✓
  - User experience:
    - Auth method selector: OAuth shown as recommended option ✓
    - Clear device code display with step-by-step instructions ✓
    - Real-time status updates (waiting, polling, success, error) ✓
    - Escape key handler for stuck flows ✓
    - Q/Esc to quit from auth method selector ✓
  - Advanced features:
    - Comprehensive OAuth scopes (repo, read:org, user, delete_repo, workflow, packages) ✓
    - Organisation access management (Ctrl+W in org switcher opens GitHub settings) ✓
    - Refresh organisations list after granting permissions (R key) ✓
    - British English throughout interface (organisation, authorisation, colour) ✓
  - Benefits: No manual PAT creation, automatic scoping, better security, improved UX ✓

- [x] Logout (clear stored token)
  - Assigned key: `Ctrl+L` to open logout prompt
  - Confirmation modal: "Are you sure you want to log out?"
    - `Esc` or `N` = cancel
    - `Y` or `Enter` = confirm
  - On confirm:
    - Remove token from config (delete token field or whole file if only token is stored)
    - Clear in-memory token and return to the Authentication Required prompt (token bootstrap screen)
    - Show success toast (e.g., "Logged out. Token cleared.")
  - Handle errors gracefully and keep user in current state on failure

- [x] Visibility filtering with modal interface
  - Assigned key: `V` to open visibility filter modal ✓
  - Modal shows options: All, Public, Private/Internal (combined for enterprise) ✓
  - Detection of enterprise accounts via `enterpriseOwners` field ✓
  - Shows ENT badge for enterprise organizations ✓
  - Server-side filtering using GitHub's `privacy` parameter ✓
  - Local filtering for INTERNAL repos (API limitation workaround) ✓
  - Persistence of visibility filter preference in config ✓
  - Modal navigation with arrow keys, Enter to select, Esc to cancel ✓
  - Fixed issue with private repository filtering not working ✓
  - Refactored to use RepoListHeader component consistently ✓
  - Compact modal design to save screen space ✓

## Later

- [ ] Language filter and indicators
  - Quick language cycling; language legend in footer

- [ ] Bulk actions
  - Multi‑select and apply action to selection

- [~] CLI flags (partial implementation)
  - [x] `--version` / `-v` flag to show version
  - [x] `--help` / `-h` flag to show usage
  - [x] `--org` to start with specific organization
    - Launch with `--org <slug>` to jump to that organisation context if accessible; otherwise ignored
    - Works with already authenticated session; overrides persisted context for the run
  - [ ] `--token` / `-t` to provide a token for this run
    - Accepts `--token <pat>` and `--token=<pat>` (and `-t` forms)
    - Overrides env/config for the current process only; does not persist
    - Show a brief security note about shell history; prefer env var or interactive prompt
  - [ ] `--sort` to set initial sort field
  - [ ] `--filter` to set initial filter
  - [ ] `--page-size` to override default page size

- [ ] Extended repo metadata
  - License, topics, issues count, watchers

- [ ] Testing
  - Unit tests for formatting and reducers
  - Snapshot tests for row rendering (where feasible)

 

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
- [x] Automated release workflow with compiled binaries
  - Enhanced GitHub Actions workflow to build cross-platform binaries (Linux, macOS, Windows)
  - Used pkg to create standalone executables for each platform
  - Configured semantic-release to attach binaries to GitHub releases automatically
  - Added build:binaries script for local binary creation
  - Updated documentation with installation instructions for pre-built binaries
- [x] Sync fork with upstream (`Ctrl+S`)
  - Shows modal with fork name, upstream repo, and commits behind
  - Executes sync via GitHub REST API with proper error handling
  - Updates local state and shows success/conflict messages
- [x] Server-side search with Apollo Client
  - Implemented Apollo Client with persistent cache
  - Server-side search triggers at 3+ characters
  - ESC key clears search and returns to normal listing
  - Improved UX: no auto-selection, down arrow acts like Enter
- [x] Logout functionality (`Ctrl+L`)
  - Confirmation modal with Y/N options
  - Clears stored token and returns to auth screen
  - Graceful error handling
- [x] Repository info modal (`I` key)
  - Shows detailed repository metadata
  - Displays size, language, timestamps, visibility
  - Modal overlay with ESC to close
- [x] Cache inspection (`K`)
  - Inspects Apollo cache status
  - Shows cache statistics and health
- [x] Cache purging on refresh (`R` key)
  - Purges Apollo cache files before refreshing
  - Forces network-only fetch after purge
- [x] Infinite scroll improvements
  - Inline loading indicator showing "Loading more repositories..."
  - Smarter prefetch at 80% threshold instead of 5 items from end
  - Smoother scrolling experience with earlier data loading
- [x] Packaging (npm)
  - Published to npm with executable `gh-manager-cli`
  - Verified bin field and shebang
  - Release notes automated via semantic-release
- [x] Visibility filtering with modal interface
  - Modal-based visibility filter (All, Public, Private, Internal)
  - Server-side filtering for accurate pagination
  - Persistence in config
- [x] Sort modal interface
  - Modal-based sort selection with descriptions
  - Better UX than cycling through options
- [x] Footer and layout improvements
  - Reorganized footer into 3 logical lines
  - Balanced repository item spacing
  - Updated keyboard shortcuts
