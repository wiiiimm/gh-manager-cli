# gh-manager-cli

Interactive terminal app to browse and manage your personal GitHub repositories. Built with Ink (React for CLIs) and the GitHub GraphQL API.

## Features

### Core Repository Management
- **Token Authentication**: Secure PAT storage with validation and persistence
- **Repository Listing**: Browse all your personal repositories with metadata (stars, forks, language, etc.)
- **Live Pagination**: Infinite scroll with automatic page prefetching
- **Real-time Sorting**: Server-side sorting by updated, pushed, name, or stars (with direction toggle)
- **Smart Filtering**: Client-side search through repository names and descriptions
- **Repository Actions**:
  - Open in browser (Enter/`o`)
  - Delete repository (`Del`/Backspace) with secure two-step confirmation
  - Archive/unarchive repositories (`a`) with confirmation prompts

### User Interface & Experience
- **Keyboard Navigation**: Full keyboard control (arrow keys, PageUp/Down, `g`/`G`)
- **Display Density**: Toggle between compact/cozy/comfy spacing (`t`)
- **Visual Indicators**: Fork status, private/archived badges, language colors
- **Loading States**: Contextual loading screens for sorting and refreshing operations
- **Rate Limit Monitoring**: Live API usage display with visual warnings

### Technical Features
- **Preference Persistence**: UI settings (sort, density) saved between sessions
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Secure Storage**: Token stored with proper file permissions (0600)
- **Error Handling**: Graceful error recovery with retry mechanisms
- **Performance**: Efficient GraphQL queries with virtualized rendering

## Quick Start

Prerequisites:
- Node.js 18+
- pnpm

Install and build:

```bash
pnpm install
pnpm build
```

Run locally:

```bash
node dist/index.js
# Or add to PATH for dev
pnpm link
gh-manager
```

## Token & Security

The app needs a GitHub token to read your repositories.

- Provide via env var: `GITHUB_TOKEN` or `GH_TOKEN`, or enter when prompted on first run.
- Recommended: classic PAT with `repo` scope for listing both public and private repos (read is sufficient).
- Validation: a minimal `viewer { login }` request verifies the token.
- Storage: token is saved as JSON in your OS user config directory with POSIX perms `0600`.
  - macOS: `~/Library/Preferences/gh-manager-cli/config.json`
  - Linux: `~/.config/gh-manager-cli/config.json`
  - Windows: `%APPDATA%\gh-manager-cli\config.json`
- Revocation: you can revoke the PAT at any time in your GitHub settings.

Note: Tokens are stored in plaintext on disk with restricted permissions. Future work may add OS keychain support.

## Usage

Launch the app, then use the keys below:

- Navigation: Up/Down, PageUp/PageDown, `Ctrl+G` (top), `G` (bottom)
- Refresh: `R`
- Filter: `/` to enter, type query, Enter to apply (Esc cancels)
- Sorting: `S` to cycle field (updated → pushed → name → stars → forks), `D` to toggle direction
- Display density: `T` to toggle compact/cozy/comfy
- Open in browser: Enter or `O`
- Delete repository: `Del` or `Ctrl+Backspace` (with confirmation modal)
  - Uses GitHub REST API (requires `delete_repo` scope and admin rights)
  - Two-step confirm: type code → confirm (Y/Enter)
  - Confirm: press `Y` or Enter
  - Cancel: press `C` or Esc
- Archive/Unarchive: `Ctrl+A`
- Toggle fork metrics: `F`
- Quit: `Q` or Esc

Status bar shows loaded count vs total. A rate-limit line displays `remaining/limit` and the reset time; it turns yellow when remaining ≤ 10% of the limit.

## Pagination Details

- Uses GitHub GraphQL `viewer.repositories` with `ownerAffiliations: OWNER`, ordered by `UPDATED_AT DESC`.
- Fetches 50 repos per page and updates `totalCount` each time.
- Prefetches the next page when your selection nears the end of the loaded list.

## Development

Stack:
- UI: `ink`, `ink-text-input`, `ink-spinner`
- API: `@octokit/graphql`
- Config paths: `env-paths`
- Language: TypeScript
- Build: `tsup` (CJS output with shebang)

Scripts:

```bash
pnpm build   # build to dist/
pnpm dev     # watch mode
pnpm start   # node dist/index.js
```

Notes:
- In development mode (set `NODE_ENV=development` or `GH_MANAGER_DEV=1`), the app fetches 5 repos per page to speed iteration.

Project layout:
- `src/index.tsx` — CLI entry and error handling
- `src/ui/App.tsx` — token bootstrap, renders `RepoList`
- `src/ui/RepoList.tsx` — list UI, keys, filtering, sorting, infinite scroll
- `src/github.ts` — GraphQL client and queries (repos + rateLimit)
- `src/config.ts` — token read/write and file perms
- `src/types.ts` — shared types

## Troubleshooting

- Invalid token: enter a valid PAT (recommended scope: `repo`).
- Rate limited: wait for the reset shown in the banner or reduce navigation.
- Network errors: check connectivity and press `r` to retry.

## Todo & Roadmap

For the up-to-date task board, see [TODOs.md](./TODOs.md).

Highlights on deck:
- Density toggle for row spacing (compact/cozy/comfy)
- Repo actions (archive/unarchive, delete) with confirmations
- Organization support and switching
- Server-side search; cached first page for faster startup
- Optional OS keychain storage via `keytar`

## License

MIT
