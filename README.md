# gh-manager-cli

Interactive terminal app to browse and manage your personal GitHub repositories. Built with Ink (React for CLIs) and the GitHub GraphQL API.

## Screenshots

<div align="center">

### Repository Listing
Browse your repositories with rich metadata, sorting, and filtering options.

<img src="docs/demo_repo_listing.png" alt="Repository listing interface showing repositories with metadata" width="800">

### Authentication Flow  
Secure GitHub token authentication with validation and persistence.

<img src="docs/demo_login.png" alt="Login screen prompting for GitHub token" width="800">

### Delete Confirmation
Safe repository deletion with two-step confirmation process.

<img src="docs/demo_delete_confirmation.png" alt="Delete confirmation dialog with security prompts" width="800">

</div>

## Quick Start

```bash
# Run with npx (no install)
npx gh-manager
```

On first run, you'll be prompted for a GitHub Personal Access Token.

## Features

### Core Repository Management
- **Token Authentication**: Secure PAT storage with validation and persistence
- **Repository Listing**: Browse all your personal repositories with metadata (stars, forks, language, etc.)
- **Live Pagination**: Infinite scroll with automatic page prefetching
- **Real-time Sorting**: Server-side sorting by updated, pushed, name, or stars (with direction toggle)
- **Smart Filtering**: Client-side search through repository names and descriptions
- **Repository Actions**:
  - Open in browser (Enter/`O`)
  - Delete repository (`Del` or `Ctrl+Backspace`) with secure two-step confirmation
  - Archive/unarchive repositories (`Ctrl+A`) with confirmation prompts
  - Sync forks with upstream (`Ctrl+U`) with automatic conflict detection

### User Interface & Experience
- **Keyboard Navigation**: Full keyboard control (arrow keys, PageUp/Down, `Ctrl+G`/`G`)
- **Display Density**: Toggle between compact/cozy/comfy spacing (`T`)
- **Visual Indicators**: Fork status, private/archived badges, language colors
- **Loading States**: Contextual loading screens for sorting and refreshing operations
- **Rate Limit Monitoring**: Live API usage display with visual warnings

### Technical Features
- **Preference Persistence**: UI settings (sort, density) saved between sessions
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Secure Storage**: Token stored with proper file permissions (0600)
- **Error Handling**: Graceful error recovery with retry mechanisms
- **Performance**: Efficient GraphQL queries with virtualized rendering

## Installation

### NPX (Recommended - No Installation Required)

Run instantly without installing:

```bash
npx gh-manager
```

### NPM Global Install

Install globally for persistent `gh-manager` command:

```bash
npm install -g gh-manager-cli
gh-manager
```

### Pre-built Binaries (No Node.js Required)

Download standalone executables from [GitHub Releases](https://github.com/wiiiimm/gh-manager-cli/releases):

- **Linux**: `gh-manager-linux-x64`
- **macOS**: `gh-manager-macos-x64` 
- **Windows**: `gh-manager-windows-x64.exe`

Make the binary executable (Linux/macOS):
```bash
chmod +x gh-manager-*
./gh-manager-*
```

### From Source

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
- Sync fork with upstream: `Ctrl+U` (for forks only, shows commit status and handles conflicts)
- Logout: `Ctrl+L`
- Toggle fork metrics: `F`
- Quit: `Q`
- Esc: cancels modals or exits filter mode (does not quit)

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
pnpm build          # build to dist/
pnpm build:binaries # build cross-platform binaries to ./binaries/
pnpm dev            # watch mode
pnpm start          # node dist/index.js
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

## Apollo Cache (Performance)

gh-manager-cli includes optional Apollo Client caching to reduce GitHub API calls and improve performance:

### Enabling Apollo Cache

```bash
# Enable Apollo caching with debug output
GH_MANAGER_APOLLO=1 GH_MANAGER_DEBUG=1 npx gh-manager
```

### Verifying Cache is Working

1. **Debug Output**: Run with `GH_MANAGER_DEBUG=1` to see cache status:
   ```bash
   GH_MANAGER_APOLLO=1 GH_MANAGER_DEBUG=1 npx gh-manager
   ```

2. **Cache Inspection**: Press `i` (in debug mode) to inspect cache status:
   - Shows cache file size and age
   - Lists recent cache entries with timestamps
   - Displays cache directory location

3. **Performance Indicators**:
   - **From cache: YES** = Data served from cache
   - **Query time < 50ms** = Likely cache hit
   - **API credits stable** = Fewer API calls being made

### Why API Credits Might Still Decrease

Even with caching enabled, API credits may decrease due to:

- **First-time requests**: Initial data must be fetched and cached
- **Cache expiration**: Default 30-minute TTL (customize with `APOLLO_TTL_MS`)
- **Pagination**: New pages beyond the cache are fetched from API
- **Cache-and-network policy**: Updates stale cache data in background
- **Sorting changes**: Different sort orders create new cache entries

### Cache Configuration

```bash
# Custom cache TTL (milliseconds)
APOLLO_TTL_MS=1800000 npx gh-manager  # 30 minutes

# Force network-only (disable cache)
GH_MANAGER_APOLLO=0 npx gh-manager
```

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
