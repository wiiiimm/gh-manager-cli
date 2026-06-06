# Usage

Launch the app, then use the keys below to navigate and interact with your repositories.

## CLI Flags

- `--org, -o <slug>`: Start in a specific organisation context (if accessible). If the slug isn’t an organisation you belong to, the flag is ignored and the app opens in your personal context.
  - Examples: `gh-manager-cli --org acme`, `gh-manager-cli -o acme`, `npx gh-manager-cli --org=@acme`, `npx gh-manager-cli -o=@acme`
  - Leading `@` is optional. Personal usernames are not supported by `--org`/`-o` (use default personal context).

- `--token, -t <pat>`: Provide a Personal Access Token just for this run (not persisted).
  - Examples: `gh-manager-cli --token ghp_XXX`, `gh-manager-cli -t=ghp_XXX`
  - Precedence: CLI token > env (`GITHUB_TOKEN`/`GH_TOKEN`) > stored config.
  - Security: Passing tokens on the command line can appear in shell history. Prefer env vars or the interactive prompt.

- `--help, -h`: Show usage information and exit.

- `--version, -v`: Print the current version and exit.

## Navigation & View Controls

- **Top/Bottom**: `Ctrl+G` (top), `G` (bottom)
- **Page Navigation**: ↑↓ Arrow keys, PageUp/PageDown
- **Search**: `/` to enter fuzzy-search mode, start typing immediately (no minimum character count)
  - Results update instantly on each keystroke — no network calls, typo-tolerant
  - While the background fetch-all is still in progress, a hint will indicate results may be incomplete
  - Down arrow: Start browsing search results
  - Esc: Clear search and return to full repository list
- **Sort**: `S` opens sort modal with options:
  - Updated: When the repository was last modified
  - Pushed: When code was last pushed
  - Name: Alphabetical by repository name
  - Stars: Number of stars
- **Sort Direction**: `D` to toggle ascending/descending
- **Display Density**: `T` to toggle compact/cozy/comfy
- **Fork Status**: Always enabled - shows commits behind upstream for all forks
- **Visibility Filter**: `V` opens modal (All, Public, Private/Internal for enterprise)
- **Stars Mode**: `Shift+S` (personal account only) to view starred repositories

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
- **Star/Unstar**: `Ctrl+S` to toggle star status for any repository
- **Sync fork**: `Ctrl+F` (for forks only, shows commit status and handles conflicts)
- **Rename repository**: `Ctrl+R` with inline validation
- **Copy URL**: `C` to copy repository URL to clipboard (SSH/HTTPS options)

## Multi-select Mode (Bulk Operations)

Multi-select mode lets you select multiple repositories and run a bulk action (star/unstar, archive/unarchive, visibility change, or delete) against all of them at once. The actions reuse the same global shortcuts as single-repo mode; while in multi-select mode every other shortcut is disabled.

### Entering Multi-select Mode

- **`M`** — toggle multi-select mode on/off
- **`Esc`** — exit multi-select mode (clears selection)

### Selection Controls (inside multi-select mode)

- **`Space`** — toggle selection on the highlighted repository
- **`S`** — unselect all (clears selection without exiting multi-select mode)
- Navigation (↑↓, PageUp/Down, `Ctrl+G`, `G`) still works

### Bulk Action Shortcuts (require at least one selected repo)

- **`Ctrl+S`** — bulk star/unstar
- **`Ctrl+A`** — bulk archive/unarchive
- **`Ctrl+V`** — bulk visibility update
- **`Del`/`Backspace`** — bulk delete

### Running a Bulk Action

1. Enter multi-select mode with `M`
2. Select repositories with `Space`
3. Press the action shortcut above (e.g. `Ctrl+A` for archive)
4. **Intent/target (only when needed)**:
   - Star and archive auto-detect a safe toggle. If the selection has a mixed state, an intent modal asks the explicit target (e.g. "Archive all" vs "Unarchive all").
   - Visibility always prompts for the destination: Public / Private / Internal (Internal only for enterprise orgs).
5. **Review list (Confirmation 1)**: A scrollable list of all selected repos appears.
   - Use ↑↓ to navigate; `Space` to unselect individual entries before proceeding.
6. **Count prompt (Confirmation 2)**: Confirms "About to {action} {N} repositories." (Cancel/Proceed, Esc cancels.)
7. **Delete only (Confirmation 3)**: enter a 4-character verification code.
8. Progress is shown per-repo; partial failures are reported at the end.
9. On completion, selections are cleared and multi-select mode exits automatically.

### Persistence

Selections persist across search and filter changes — you can search for one set, select some repos, search for something else, select more, and all prior selections remain intact. Selections are cleared only when:

- You exit multi-select mode (`M` or `Esc`)
- You switch organisation/scope
- You toggle Stars mode
- The bulk operation completes

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
