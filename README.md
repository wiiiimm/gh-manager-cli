<p align="center">
  <img src="docs/assets/logo-horizontal.png" alt="gh-manager-cli logo" width="400" />
</p>

# gh-manager-cli

[![npm version](https://img.shields.io/npm/v/gh-manager-cli.svg)](https://www.npmjs.com/package/gh-manager-cli)
[![GitHub release](https://img.shields.io/github/release/wiiiimm/gh-manager-cli.svg)](https://github.com/wiiiimm/gh-manager-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/gh-manager-cli.svg)](https://nodejs.org)
[![GitHub Stars](https://img.shields.io/github/stars/wiiiimm/gh-manager-cli.svg)](https://github.com/wiiiimm/gh-manager-cli/stargazers)
[![Context Engineered with Claude Opus 4.1](https://img.shields.io/badge/Context%20Engineered%20with-Claude%20Opus%204.1-blue)](https://www.anthropic.com)
[![Context Engineered with Codex GPT-5](https://img.shields.io/badge/Context%20Engineered%20with-Codex%20GPT--5-green)](https://openai.com)

Interactive terminal app to browse and manage your personal GitHub repositories. Built with Ink (React for CLIs) and the GitHub GraphQL API.

<p align="center">
  <img src="docs/demo_interactive.gif" alt="Interactive demo of gh-manager-cli" width="900" />
  <br />
  <em>Fast, keyboard-first GitHub repo management from your terminal</em>
 </p>

## Documentation

| Getting Started | Features | Development |
|-----------------|----------|-------------|
| [📥 Installation](wiki/Installation.md) | [🔍 Features Overview](wiki/Features.md) | [🛠️ Development Guide](wiki/Development.md) |
| [🔑 Token & Security](wiki/Token-and-Security.md) | [⌨️ Usage & Controls](wiki/Usage.md) | [🧪 Testing](wiki/Testing.md) |
| [❓ Troubleshooting](wiki/Troubleshooting.md) | [🗺️ Roadmap](wiki/Roadmap.md) | [🏠 Wiki Home](wiki/README.md) |

## Screenshots

<div align="center">
  <img src="docs/demo_repo_listing.png" alt="Repository listing with metadata" width="31%" />
  <img src="docs/demo_login.png" alt="GitHub token authentication flow" width="31%" />
  <img src="docs/demo_delete_confirmation.png" alt="Two-step delete confirmation" width="31%" />
  <br />
  <sub>Listing • Auth • Delete confirmation</sub>
</div>

## Quick Start

```bash
# Run with npx (no install)
npx gh-manager-cli
```

On first run, you'll be prompted to authenticate with GitHub (OAuth recommended).

## Features

### Core Repository Management
- **Authentication**: GitHub OAuth (recommended) or Personal Access Token with secure storage
- **Repository Listing**: Browse all your personal repositories with metadata (stars, forks, language, etc.)
- **Live Pagination**: Infinite scroll with automatic page prefetching
- **Interactive Sorting**: Modal-based sort selection (updated, pushed, name, stars) with direction toggle
- **Smart Search**: Server-side search through repository names and descriptions (3+ characters)
- **Visibility Filtering**: Modal-based visibility filter (All, Public, Private/Internal for enterprise) with smart filtering
- **Fork Status Tracking**: Toggle display of commits behind upstream for forked repositories
- **Repository Actions**:
  - View detailed info (`I`) - Shows repository metadata, language, size, and timestamps
  - Open in browser (Enter/`O`)
  - Delete repository (`Del` or `Backspace`) with secure two-step confirmation
  - Archive/unarchive repositories (`Ctrl+A`) with confirmation prompts
  - Change repository visibility (`Ctrl+V`) - Switch between Public, Private, and Internal (enterprise only)
  - Sync forks with upstream (`Ctrl+S`) with automatic conflict detection

### User Interface & Experience
- **Keyboard Navigation**: Full keyboard control (arrow keys, PageUp/Down, `Ctrl+G`/`G`)
- **Display Density**: Toggle between compact/cozy/comfy spacing (`T`)
- **Visual Indicators**: Fork status, private/internal/archived badges, language colors, visibility status
- **Enterprise Support**: Full support for GitHub Enterprise with Internal repository visibility
- **Organization Context**: Switch between personal and organization accounts with ENT badge for enterprise orgs
- **Interactive Modals**: Sort selection, visibility filtering, organization switching, and visibility change dialogs
- **Balanced Layout**: Repository items with spacing above and below for better visual hierarchy
- **Loading States**: Contextual loading screens for sorting and refreshing operations
- **Rate Limit Monitoring**: Live API usage display with visual warnings

### Technical Features
- **Preference Persistence**: UI settings (sort, density, visibility filter, fork tracking) saved between sessions
- **Server-side Filtering**: Visibility filtering performed at GitHub API level for accurate pagination
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Secure Storage**: Token stored with proper file permissions (0600)
- **Error Handling**: Graceful error recovery with retry mechanisms
- **Performance**: Efficient GraphQL queries with virtualized rendering and server-side filtering

## Installation

### Homebrew (macOS/Linux)

```bash
brew tap wiiiimm/tap
brew install gh-manager-cli
```

### NPX (Recommended - No Installation Required)

Run instantly without installing:

```bash
npx gh-manager-cli
```

### NPM Global Install

Install globally for persistent `gh-manager-cli` command:

```bash
npm install -g gh-manager-cli
gh-manager-cli
```

### Pre-built Binaries (No Node.js Required)

Download standalone executables from [GitHub Releases](https://github.com/wiiiimm/gh-manager-cli/releases):

- **Linux**: `gh-manager-cli-linux-x64`
- **macOS**: `gh-manager-cli-macos-x64` 
- **Windows**: `gh-manager-cli-windows-x64.exe`

Make the binary executable (Linux/macOS):
```bash
chmod +x gh-manager-cli-*
./gh-manager-cli-*
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
gh-manager-cli
```

## Authentication

The app supports two authentication methods:

### 1. GitHub OAuth (Recommended) 🎯

The easiest and most secure way to authenticate:

- **Device Flow**: No need to handle callback URLs - just enter a code on GitHub's website
- **Browser-based**: Opens GitHub's authorization page automatically
- **Secure**: No client secrets or sensitive data in the app
- **Full Permissions**: Automatically requests all necessary scopes for complete functionality
- **User-friendly**: No manual token management required

When you first run the app, select **"GitHub OAuth (Recommended)"** from the authentication options. The app will:
1. Display a device code for you to enter on GitHub
2. Open your browser to GitHub's device authorization page
3. Wait for you to authorize the app
4. Securely store the OAuth token for future use

### 2. Personal Access Token (PAT)

Alternative method for users who prefer manual token management:

- Provide via env var: `GITHUB_TOKEN` or `GH_TOKEN`, or enter when prompted on first run.
- Recommended: classic PAT with `repo` scope for listing both public and private repos.
- Validation: a minimal `viewer { login }` request verifies the token.

### Token Storage & Security

- Storage: tokens are saved as JSON in your OS user config directory with POSIX perms `0600`.
  - macOS: `~/Library/Preferences/gh-manager-cli/config.json`
  - Linux: `~/.config/gh-manager-cli/config.json`
  - Windows: `%APPDATA%\gh-manager-cli\config.json`
- Revocation: you can revoke tokens at any time in your GitHub settings.

Note: Tokens are stored in plaintext on disk with restricted permissions. Future work may add OS keychain support.

### PAT Permissions & Scopes

Choose the least-privileged token for the features you plan to use:

- Browsing/searching repos (public only): `public_repo`
- Browsing/searching repos (includes private): `repo`
- Archive/Unarchive repository: `repo` (and you must have admin or maintainer rights on the repo)
- Sync fork with upstream: `repo` (you must have push rights to your fork)
- Delete repository: `delete_repo` (and admin rights on the repo)

Notes:
- Organization repositories may require that your token is SSO-authorized if the org enforces SSO.
- If organization data doesn’t appear in the switcher, ensure your token is authorized for that org and consider adding `read:org` (some org setups require it to list memberships).
- Fine-grained PATs: grant Repository access to the repos you need and enable at least:
  - Metadata: Read
  - Contents: Read (list/search), Read & Write (sync/archive)
  - Administration: Manage (only if you need delete)
  If in doubt, the classic `repo` scope plus `delete_repo` (for deletion) is the simplest equivalent.

## Usage

Launch the app, then use the keys below:

### Navigation & View Controls
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

### Navigation & Account
- **Open in browser**: Enter or `O`
- **Refresh**: `R`
- **Organization switcher**: `W` to switch between personal account and organizations
- **Logout**: `Ctrl+L`
- **Quit**: `Q`

### Repository Actions
- **Repository info**: `I` to view detailed metadata (size, language, timestamps)
- **Cache info**: `K` to inspect Apollo cache status
- **Archive/Unarchive**: `Ctrl+A` with confirmation prompt
- **Change visibility**: `Ctrl+V` to change repository visibility (Public/Private/Internal)
- **Delete repository**: `Del` or `Backspace` (with two-step confirmation modal)
  - Type confirmation code → confirm (Y/Enter)
  - Cancel: press `C` or Esc
- **Sync fork**: `Ctrl+S` (for forks only, shows commit status and handles conflicts)

### General
- **Esc**: Cancels modals, clears search, or returns to normal listing (does not quit)

The header displays the current owner context (Personal Account or Organization name), active sort and direction, fork status tracking state, and active search/filter.

Status bar shows loaded count vs total. A rate-limit line displays `remaining/limit` and the reset time; it turns yellow when remaining ≤ 10% of the limit.

## Pagination Details

- Uses GitHub GraphQL `viewer.repositories` with `ownerAffiliations: OWNER`, ordered by `UPDATED_AT DESC`.
- Fetches 15 repos per page by default (configurable via `REPOS_PER_FETCH` environment variable, 1-50).
- Updates `totalCount` each time and prefetches the next page when selection nears the end of loaded list.

## Development

Stack:
- UI: `ink`, `ink-text-input`, `ink-spinner`
- API: `@octokit/graphql`, Apollo Client
- Config paths: `env-paths`
- Language: TypeScript
- Build: `tsup` (CJS output with shebang)

Scripts:

```bash
pnpm build          # build to dist/
pnpm build:binaries # build cross-platform binaries to ./binaries/
pnpm dev            # watch mode
pnpm start          # run normally
pnpm start:debug    # run with debug mode enabled
pnpm start:dev      # run with 5 repos per page and debug mode
```

Environment variables:
- `REPOS_PER_FETCH`: Number of repositories to fetch per page (1-50, default: 15)
- `GH_MANAGER_DEBUG=1`: Enables debug mode with performance metrics and detailed errors

Project layout:
- `src/index.tsx` — CLI entry and error handling
- `src/ui/App.tsx` — token bootstrap, renders `RepoList`
- `src/ui/RepoList.tsx` — main list UI with modal management
- `src/ui/components/` — modular components (modals, repo, common)
  - `modals/` — DeleteModal, ArchiveModal, SyncModal, InfoModal, LogoutModal
  - `repo/` — RepoRow, FilterInput, RepoListHeader
  - `common/` — SlowSpinner and shared UI elements
- `src/ui/OrgSwitcher.tsx` — organization switching component
- `src/github.ts` — GraphQL client and queries (repos + rateLimit)
- `src/config.ts` — token read/write and UI preferences
- `src/types.ts` — shared types
- `src/utils.ts` — utility functions (truncate, formatDate)
- `src/apolloMeta.ts` — Apollo cache management

## Apollo Cache (Performance)

gh-manager-cli includes built-in Apollo Client caching to reduce GitHub API calls and improve performance. Caching is **always enabled** for optimal performance.

### Debug Mode

Run with `GH_MANAGER_DEBUG=1` to enable debugging features:
```bash
GH_MANAGER_DEBUG=1 npx gh-manager-cli
```

Debug mode provides:
- **Apollo performance metrics**: Query execution time, cache hit/miss indicators
- **Detailed error messages**: Full GraphQL and network errors for troubleshooting
- **Data source tracking**: Shows whether data came from cache or network

### Verifying Cache is Working

1. **Performance Indicators** (visible in debug mode):
   - **From cache: YES** = Data served from cache
   - **Query time < 50ms** = Likely cache hit
   - **Network status codes** = Shows Apollo's internal cache state

2. **API Credits**: Monitor the API counter in the header - it should remain stable when navigating previously loaded data

3. **Cache Inspection**: Press `K` (available anytime) to see:
   - Cache file location and size
   - Recent cache entries with timestamps
   - Cache age for each query type

### Why API Credits Might Still Decrease

Even with caching enabled, API credits may decrease due to:

- **First-time requests**: Initial data must be fetched and cached
- **Cache expiration**: Default 30-minute TTL (customize with `APOLLO_TTL_MS`)
- **Pagination**: New pages beyond the cache are fetched from API
- **Cache-and-network policy**: Updates stale cache data in background
- **Sorting changes**: Different sort orders create new cache entries

### Configuration

```bash
# Number of repositories to fetch per page (1-50, default: 15)
REPOS_PER_FETCH=10 npx gh-manager-cli

# Custom cache TTL (milliseconds) - default: 30 minutes
APOLLO_TTL_MS=1800000 npx gh-manager-cli

# Enable debug mode to see cache performance
GH_MANAGER_DEBUG=1 npx gh-manager-cli

# Combine multiple environment variables
REPOS_PER_FETCH=5 GH_MANAGER_DEBUG=1 npx gh-manager-cli-cli
```

## Troubleshooting

- Invalid token: enter a valid PAT (recommended scope: `repo`).
- Rate limited: wait for the reset shown in the banner or reduce navigation.
- Network errors: check connectivity and press `r` to retry.

## Todo & Roadmap

For the up-to-date task board, see [TODOs.md](./TODOs.md).

Recently implemented:
- ✅ OAuth login flow as an alternative to Personal Access Token
- ✅ Density toggle for row spacing (compact/cozy/comfy)
- ✅ Repo actions (archive/unarchive, delete, change visibility) with confirmations
- ✅ Organization support and switching (press `W`) with enterprise detection
- ✅ Enhanced server-side search with improved UX and organization context support
- ✅ Smart infinite scroll with 80% prefetch trigger
- ✅ Modal-based sort and visibility filtering
- ✅ GitHub Enterprise support with Internal repository visibility
- ✅ Change repository visibility modal (`Ctrl+V`)
- ✅ Compact filter modals for better screen space utilization

Highlights on deck:
- Optional OS keychain storage via `keytar`
- Bulk selection and actions
- Repository renaming

## License

MIT
