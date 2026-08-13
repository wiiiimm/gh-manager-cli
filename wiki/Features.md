# Features

A complete overview of what gh-manager-cli can do, grouped by area.

## Core Repository Management

- **Authentication:** GitHub OAuth (recommended) or Personal Access Token with secure storage. (See [Token & Security](Token-and-Security.md).)
- **Repository Listing:** browse all your personal repositories with metadata (stars, forks, language, etc.).
- **Background Fetch-All:** loads your entire account in the background after the first page, so filtering/sorting/search are instant and complete.
- **Interactive Sorting:** modal-based sort selection (updated, pushed, name, stars) with modal-based direction selection.
- **Fuzzy Search:** instant typo-tolerant search over the full cached repository set — no network calls in the search path (powered by [fuse.js](https://www.fusejs.io/)).
- **View Filters:** single `V` modal consolidating visibility, archive, and fork filters into three grouped sections — set any combination in one session (All / Public / Private[/Internal] · All / Unarchived / Archived · All / Forks only / Non-forks only). The fork filter runs entirely client-side over the cached set.
- **Fork Ahead/Behind Tracking:** after the background fetch-all completes, forks are enriched with both ahead and behind commit counts in a separate lightweight pass (batched 5 at a time to avoid rate-limit issues).
- **Stars Mode:** view and manage starred repositories (personal account only).
- **Repository Actions:** view detailed info (`I`); open in browser (Enter/`O`, forks offer this repo or upstream); jump to PRs/Issues (`L`, with inline counts on every row); jump to upstream (`P`); create new repository (`Ctrl+N`); rename (`Ctrl+R`); transfer to another owner (`Shift+M`); copy URL (`C`, SSH/HTTPS); delete (`Del`/`Backspace`, two-step confirmation); archive/unarchive (`Ctrl+A`); change visibility (`Ctrl+V`); star/unstar (`Ctrl+S`); sync forks with upstream (`Ctrl+F`, ahead/behind counts and conflict detection).
- **Bulk Operations** (`B` to enter Bulk Select mode): select multiple repos with `Space`, `X` unselects all; bulk actions reuse global shortcuts (`Ctrl+S` star/unstar, `Ctrl+A` archive/unarchive, `Ctrl+V` visibility, `Del` delete, `Shift+M` transfer); selections persist across search/filter/sort; confirmation flow with review → count prompt → verification code (delete/transfer); per-repo progress with partial-failure summary. (See [Usage](Usage.md) for the full flow.)

## User Interface & Experience

- **Keyboard Navigation:** full keyboard control (arrow keys, PageUp/Down, `Ctrl+G`/`G`).
- **Display Density:** toggle compact/cozy/comfy spacing (`T`).
- **Colour Themes:** four themes (Default, Ocean, Forest, Monochrome) cycled with `Shift+T`, persisted across restarts; theme-aware selected-row highlight tuned per theme for readable contrast.
- **Collapsible key hints:** `H` collapses the help footer to one line of important shortcuts (including the toggle itself) so more repositories fit on screen; expands back to the full reminder set. Persists across restarts.
- **Visual Indicators:** fork status, private/internal/archived badges, language colours, visibility status.
- **Enterprise Support:** full support for GitHub Enterprise with Internal repository visibility.
- **Organisation Context:** switch between personal and organisation accounts with an ENT badge for enterprise orgs.
- **Interactive Modals:** sort selection, visibility filtering, organisation switching, and visibility change dialogs.
- **Loading States:** contextual loading screens for sorting and refreshing operations.
- **Rate Limit Monitoring:** dual API rate limit display (GraphQL & REST) with real-time usage deltas and visual warnings.

## Technical Features

- **Preference Persistence:** UI settings (sort, density, visibility/archive/fork filters, fork commit tracking, colour theme, footer collapse) saved between sessions.
- **Client-side Filtering & Sorting:** once the account is cached via background fetch-all, visibility/archive/fork filtering and all sorting run locally over the complete set — instant, with no server refetch.
- **Cross-platform:** works on macOS, Linux, and Windows.
- **Secure Storage:** token stored with proper file permissions (0600).
- **Error Handling:** graceful error recovery with retry mechanisms.
- **Performance:** light bulk GraphQL queries, virtualised rendering, and React.memo-optimised rows for instant keyboard navigation.
- **Comprehensive Logging:** structured JSON logging with automatic rotation and configurable verbosity. (See [Logging](Logging.md).)

## Related Pages

- [Installation](Installation.md)
- [Usage](Usage.md)
- [Token & Security](Token-and-Security.md)
- [Logging](Logging.md)
