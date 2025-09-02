# Usage

Launch the app, then use the keys below to navigate and interact with your repositories.

## CLI Flags

- `--org <slug>`: Start in a specific organisation context (if accessible). If the slug isn’t an organisation you belong to, the flag is ignored and the app opens in your personal context.
  - Examples: `gh-manager-cli --org acme`, `npx gh-manager-cli --org=@acme`
  - Leading `@` is optional. Personal usernames are not supported by `--org` (use default personal context).

## Navigation & View Controls

- **Top/Bottom**: `Ctrl+G` (top), `G` (bottom)
- **Page Navigation**: ↑↓ Arrow keys, PageUp/PageDown
- **Search**: `/` to enter search mode, type 3+ characters for server-side search
  - Down arrow or Enter: Start browsing search results
  - Esc: Clear search and return to full repository list
- **Sort**: `S` opens sort modal with options:
  - Updated: When the repository was last modified
  - Pushed: When code was last pushed
  - Name: Alphabetical by repository name
  - Stars: Number of stars
- **Sort Direction**: `D` to toggle ascending/descending
- **Display Density**: `T` to toggle compact/cozy/comfy
- **Fork Status**: `F` to toggle showing commits behind upstream
- **Visibility Filter**: `V` opens modal (All, Public, Private/Internal for enterprise)

## Navigation & Account

- **Open in browser**: Enter or `O`
- **Refresh**: `R`
- **Organization switcher**: `W` to switch between personal account and organizations
- **Logout**: `Ctrl+L`
- **Quit**: `Q`

## Repository Actions

- **Repository info**: `I` to view detailed metadata (size, language, timestamps)
- **Cache info**: `K` to inspect Apollo cache status
- **Archive/Unarchive**: `Ctrl+A` with confirmation prompt
- **Change visibility**: `Ctrl+V` to change repository visibility (Public/Private/Internal)
- **Delete repository**: `Del` or `Backspace` (with two-step confirmation modal)
  - Type confirmation code → confirm (Y/Enter)
  - Cancel: press `C` or Esc
- **Sync fork**: `Ctrl+S` (for forks only, shows commit status and handles conflicts)

## General

- **Esc**: Cancels modals, clears search, or returns to normal listing (does not quit)

## Interface Elements

- **Header**: Displays the current owner context (Personal Account or Organization name), active sort and direction, fork status tracking state, and active search/filter.
- **Status Bar**: Shows loaded count vs total. A rate-limit line displays `remaining/limit` and the reset time; it turns yellow when remaining ≤ 10% of the limit.

## Pagination Details

- Uses GitHub GraphQL `viewer.repositories` with `ownerAffiliations: OWNER`, ordered by `UPDATED_AT DESC`.
- Fetches 15 repos per page by default (configurable via `REPOS_PER_FETCH` environment variable, 1-50).
- Updates `totalCount` each time and prefetches the next page when selection nears the end of loaded list.

## Environment Variables

- `REPOS_PER_FETCH`: Number of repositories to fetch per page (1-50, default: 15)
- `GH_MANAGER_DEBUG=1`: Enables debug mode with performance metrics and detailed errors
- `APOLLO_TTL_MS`: Custom cache TTL in milliseconds (default: 30 minutes)

## Related Pages

- [Features](Features.md) - Detailed feature list
- [Token & Security](Token-and-Security.md) - Authentication details
- [Troubleshooting](Troubleshooting.md) - Common issues and solutions
