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

- [ ] Repo actions with confirmations
  - Archive / Unarchive repositories
    - Key mapping: `a` to toggle archive status (archive if active, unarchive if archived)
    - GraphQL mutations: `archiveRepository` and `unarchiveRepository`
    - Confirmation modal with warning: 
      - Archive: "⚠️  Archive [repo-name]? This will make it read-only. (y/N)"
      - Unarchive: "Unarchive [repo-name]? This will make it active again. (y/N)"
      - User must confirm with 'y' or Enter, Esc/c to cancel
    - Update local state (`isArchived` field) after successful operation
    - Handle API errors gracefully (403 for insufficient permissions, etc.)
  - Archive badge in repository list
    - Show "Archived" badge or indicator next to archived repositories in main listing
    - Use distinct styling (gray/dim text or special icon) to visually distinguish archived repos
    - Badge should be visible but not obtrusive to maintain clean UI
  - Delete (dangerous; detailed confirm flow; handle missing scopes gracefully)
    - Assign a key to trigger delete: `Del` or `Backspace` from the list view
    - Show a full-screen modal overlay with repo info (nameWithOwner, visibility, stars, forks, updatedAt)
    - Require user to type a 4-character uppercase validation string to confirm
      - Generate 4 random uppercase letters, excluding `C` for each character
      - Example generator: choose from `ABDEFGHIJKLMNOPQRSTUVWXYZ` 4 times
      - The generated code must never contain `C`
    - Confirmation mechanics
      - User types the exact code then presses Enter to proceed
      - Pressing `Esc` or `c` cancels the deletion (case-sensitive)
      - Because `c` is cancel, ensure the generated code never includes `C`
    - Execute delete via GitHub REST API (DELETE /repos/{owner}/{repo}); GraphQL has no delete mutation
      - Requires `delete_repo` scope and admin permissions on the repo
    - On success: close modal, remove repo from list, refresh totalCount
    - On failure: show error in modal, allow retry or cancel
  - Respect read‑only tokens (hide actions or show tooltip)

- [ ] Rename repository
  - Assign a key to trigger rename: e.g. `e` (Edit name)
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
    - Keyboard: assign `w` (Workspace/Who) to open the switcher; Up/Down to select; Enter to switch; Esc to cancel
    - Persist last-selected context and show it in header (e.g., “Repositories — Personal Account” or “Repositories — org: @acme”)
    - Apply context to repo queries (scoped owner/org), and refresh list/totalCount on switch

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

- [ ] Sorting enhancements
  - Additional fields (created, size)
  - Persist sort field + direction in config

- [ ] First‑page cache
  - Cache first page on disk to speed startup
  - Short TTL and invalidation on manual refresh

- [ ] Rate‑limit improvements
  - Show reset time in footer
  - Color thresholds and gentle throttling when low

- [ ] OS keychain support
  - Optional storage via `keytar`; fallback to file with 0600 perms

- [ ] Window resize handling
  - Recompute layout on terminal resize; keep selection visible

- [ ] Copy repository URL to clipboard
  - HTTPS URL copy
    - Assign key: `y` (yank) to copy `https://github.com/<owner>/<repo>.git`
    - On success: show a short-lived footer toast (e.g., “Copied HTTPS URL”)
    - On failure: show error toast with suggestion
  - SSH URL copy
    - Assign key: `Y` (shift+y) to copy `git@github.com:<owner>/<repo>.git`
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
  - Assign key to open logout prompt (e.g., `l` or `Ctrl+L`)
  - Confirmation modal: "Are you sure you want to log out?"
    - `Esc` or `n` = cancel
    - `y` or `Enter` = confirm
  - On confirm:
    - Remove token from config (delete token field or whole file if only token is stored)
    - Clear in-memory token and return to token bootstrap screen
    - Show success toast (e.g., "Logged out. Token cleared.")
    - Quit the app after logout (graceful exit)
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
- [x] Sorting toggles (`s` field, `d` direction)
- [x] Open selected repo in browser (Enter / `o`)
- [x] Rate‑limit indicator (remaining/limit)
- [x] Row spacing via Box height with virtualization fix
