# Usage

Full reference for running gh-manager-cli, its keyboard controls, command-line flags, pagination behaviour, and the end-of-session summary.

See also: [Features](Features.md) · [Token & Security](Token-and-Security.md) · [Troubleshooting](Troubleshooting.md)

## CLI Flags

- `--org, -o <slug>`: Start in a specific organisation context (if accessible). The flag is ignored if you don't have access or if the slug isn't an organisation.
  - Examples: `gh-manager-cli --org acme`, `gh-manager-cli -o acme`, `npx gh-manager-cli@latest --org=@acme`, `npx gh-manager-cli@latest -o=@acme`
  - Notes: A leading `@` is optional. Personal usernames are not supported by `--org`/`-o` (use the default personal context).
- `--token, -t <pat>`: Use a Personal Access Token just for this run. Does not persist to config.
  - Examples: `gh-manager-cli --token ghp_XXXX`, `gh-manager-cli -t=ghp_XXXX`
  - Precedence: CLI token > `GITHUB_TOKEN`/`GH_TOKEN` env vars > stored config.
  - Security: Supplying tokens on the command line may be captured in shell history. Prefer env vars or the interactive prompt when possible.
- `--help, -h`: Show usage information and exit.
- `--version, -v`: Print the current version and exit.

## Navigation & View Controls

- **Top/Bottom**: `Ctrl+G` (top), `G` (bottom).
- **Page Navigation**: ↑↓ arrow keys, PageUp/PageDown.
- **Search**: `/` to enter search mode — instant, typo-tolerant fuzzy search over the full cached set (no network calls). Matches as you type; searches name, owner, description, and language. Down arrow or Enter starts browsing results. Esc clears the search and returns to the full list.
- **Sort**: `S` opens the sort modal (Updated, Pushed, Name, Stars).
- **Sort Direction**: `D` opens the sort direction modal (ascending/descending).
- **Display Density**: `T` toggles compact/cozy/comfy.
- **Colour Theme**: `Shift+T` cycles themes (Default → Ocean → Forest → Monochrome); persists across restarts. Each theme defines its own selected-row highlight (a darker on-theme background) so the highlighted repository stays high-contrast.
- **Fork Status**: always enabled — shows commits ahead and behind upstream once enrichment completes. Unrelated to the fork view filter.
- **View Filters**: `V` opens the consolidated View Filters modal with three grouped sections — Visibility (All / Public / Private[/Internal for enterprise]), Archive (All / Unarchived / Archived), and Fork (All / Forks only / Non-forks only). Move between groups with ↑↓, change a group's value live with ←→ (radio-style), then Enter (or `Y`/Apply) to apply and close, Esc/`C` to cancel. The Visibility group is hidden in stars mode; Archive and Fork remain available. All three selections persist across restarts, and reset to All when you switch organisation or scope (own ↔ starred).
- **Stars Mode**: `Shift+S` (personal account only) toggles between your own repos and your starred repos. The footer hint shows `Shift+S Starred` in normal mode and `Shift+S My Repos` in starred mode.

## Navigation & Account

- **Open in browser**: Enter or `O` — non-forks open directly; forks show a chooser (This repository / Parent/upstream, Esc cancels).
- **Open PRs / Issues**: `L` — chooser modal (Pull Requests / Issues) for the selected repo. Counts are shown inline on every row as `⇄ N PRs ◇ M issues`, colour-coded (muted at 0, default 1–9, amber 10–29, red 30+). Esc/C cancels.
- **Jump to upstream**: `P` (on a fork) — moves the cursor to the parent if already loaded; otherwise fetches the parent and shows it in the Info modal.
- **Refresh**: `R`.
- **Organisation switcher**: `W`.
- **Logout**: `Ctrl+L`.
- **Quit**: `Q`.

## Repository Actions

- **Create repository**: `Ctrl+N` — new repo in the current context (personal or organisation). Prompts for a name with the owner slug (`owner/`) shown in front; `Tab` cycles visibility (Private/Public, plus Internal for enterprise organisations); Enter to create; GitHub errors (e.g. name already exists) shown inline.
- **Repository info**: `I` — detailed metadata (size, language, timestamps).
- **Cache info**: `K` — inspect Apollo cache status.
- **Archive/Unarchive**: `Ctrl+A` with confirmation prompt.
- **Change visibility**: `Ctrl+V` (Public/Private/Internal).
- **Delete repository**: `Del` or `Backspace` (two-step confirmation modal; type the confirmation code → confirm with Y/Enter; cancel with `C` or Esc).
- **Star/Unstar**: `Ctrl+S`.
- **Sync fork**: `Ctrl+F` (for forks only; shows ahead/behind counts and handles conflicts).
- **Rename repository**: `Ctrl+R` with inline validation.
- **Transfer repository**: `Shift+M` (Move) to transfer ownership to another user or organisation. The destination picker lists the personal account + organisations the token can see; pick with ↑/↓ + Enter, press `M` (or select "Enter a different owner…") to switch to manual entry for owners the token can't list. Requires typing a randomly generated verification code (like delete), then a final confirmation. GitHub errors shown inline.
- **Copy URL**: `C` to copy the repository URL to the clipboard (SSH/HTTPS options).

## Bulk Operations (Bulk Select mode)

- `B` enters/exits Bulk Select mode (exits and clears the selection). `Esc` also exits and clears.
- Within bulk mode every other shortcut is disabled; only navigation + these work: `Space` toggles selection on the cursor row; `X` unselects all (stays in bulk mode); navigation (arrows, PageUp/Down, `Ctrl+G`, `G`) still works.
- Bulk actions reuse the global shortcuts: `Ctrl+S` star/unstar, `Ctrl+A` archive/unarchive, `Ctrl+V` visibility, `Del`/`Backspace` delete, `Shift+M` transfer (move) to another owner/org. Each requires at least one selected repo.
- Star and archive are toggles: if all selected share the same state, the opposite is applied directly; if the selection is mixed, an intent modal asks the explicit target. Visibility always shows a target picker (Public / Private / Internal — Internal only for enterprise orgs). Transfer opens a destination picker (personal account + visible orgs, plus a manual-entry fallback).
- Selections persist across search, filter, and sort changes (stored as full node objects by id). They are cleared on org/scope switch and stars mode toggle.
- **Confirmation flow**: review list with the ability to unselect (Space) → (transfer only) destination owner picker → count prompt → (delete and transfer only) a 4-character verification code → sequential execution with per-repo progress and a partial-failure summary at completion. The selection is cleared and bulk mode exits on completion; transferred repos are removed from the list.

## Modal UX Convention

- Left/Right: move focus between buttons (e.g. Delete, Cancel).
- Enter: run the focused button's action.
- `Y`: confirm.
- `C`: cancel (Esc also cancels).

## General

- Esc cancels modals, clears search, or returns to normal listing (it does not quit).
- The header displays the current owner context (Personal Account or Organisation name), active sort and direction, fork status tracking state, and active search/filter.
- The status bar shows the loaded count vs total. A rate-limit line displays `remaining/limit` and the reset time; it turns yellow when remaining ≤ 10% of the limit.

## Pagination Details

- Uses the GitHub GraphQL `viewer.repositories` query with `ownerAffiliations: OWNER`, ordered by `UPDATED_AT DESC`.
- **Background fetch-all**: the first page renders immediately, then the remaining repositories load in the background until the whole account is cached locally. Filtering, sorting, and search then operate over the complete set, client-side and instant.
- Fetches 100 repos per page by default (configurable via the `REPOS_PER_FETCH` environment variable, 1–100).
- Reads `totalCount` from the first page and shows background-load progress (`loaded/total`) while filling. The list stays usable from the first page throughout; very large accounts simply take longer to finish loading.

## Session Summary

When you quit the app with `Q`, gh-manager-cli prints a short end-of-session report as distinct framed panels:

- **📊 Session Summary** — session duration, total operations performed, and a per-operation breakdown (e.g. "2 repositories archived", "1 repository transferred"). If nothing was changed, it notes "No changes were made this session."
- **⏱ Estimated time saved** — a rough, friendly estimate of how much time you saved versus performing those operations by hand on github.com (each operation type has a conservative manual-time weight, e.g. delete ≈ 45s, transfer ≈ 60s, star ≈ 6s). Shown only when at least one operation was performed.
- **💚 Thank you** — a separate sponsorship/feedback panel.

Both single-repo and bulk actions are counted. The summary is not shown when exiting via `Ctrl+C`.

## Related Pages

- [Features](Features.md)
- [Token & Security](Token-and-Security.md)
- [Troubleshooting](Troubleshooting.md)
