# AGENTS.md - gh-manager-cli Project Memory & Instructions

## Project Overview

**gh-manager-cli** is an interactive CLI tool built with Ink (React for terminals) that helps users manage GitHub repositories. This project provides a terminal-based UI for browsing, searching, and managing personal GitHub repos with real-time API integration.

### Current Status: Active Development
- ✅ Core repository listing functionality
- ✅ GitHub GraphQL API integration with Apollo Client caching
- ✅ Interactive terminal UI with Ink
- ✅ OAuth and PAT authentication with secure storage
- ✅ Background fetch-all (whole account cached after first page)
- ✅ Repository management (delete, archive, visibility change)
- ✅ GitHub Enterprise support with Internal visibility
- ✅ Organization switching and context management
- ✅ Fork synchronization with upstream
- ✅ Semantic release automation and CI/CD workflows
- ✅ Automated changelog generation and PR title management
- 🔧 Automated test suite expansion (ongoing)
- 🔧 Cross-terminal rendering optimization

**For current version and recent changes, see [CHANGELOG.md](./CHANGELOG.md)**

## Repository Structure

```
gh-manager-cli/
├── src/
│   ├── index.tsx              # CLI entry, error boundaries, renders App
│   ├── ui/
│   │   ├── App.tsx            # Token bootstrap and routing
│   │   └── RepoList.tsx       # Repository list UI, key handling, infinite scroll
│   ├── github.ts              # Octokit GraphQL client and queries
│   ├── config.ts              # Read/write config and token management
│   └── types.ts               # TypeScript type definitions
├── dist/                      # Built output (gitignored)
├── package.json               # NPM package config with semantic-release
├── tsconfig.json              # TypeScript configuration
├── tsup.config.ts             # Build configuration (shebang-preserved CJS)
├── CHANGELOG.md               # Generated changelog (semantic-release)
├── README.md                  # User documentation
├── LICENSE                    # MIT License
├── AGENTS.md                  # This file - project memory/instructions
├── .gitignore                 # Git ignore patterns
└── .github/
    ├── workflows/
    │   ├── automated-release.yml    # Semantic release on main push
    │   └── pr-title-manager.yml     # PR title automation
    └── scripts/
        └── normalize-pr-title.js    # PR title normalization logic
```

## Core Features

### Main Script (`src/index.tsx`)
- **Language:** TypeScript with React/Ink
- **Dependencies:** 
  - `@octokit/graphql` for GitHub API
  - `ink` (React-based TUI)
  - `chalk` for terminal colors
  - `ink-spinner` for loading states
  - `ink-text-input` for user input
  - `env-paths` for cross-platform config storage
- **Build:** tsup with esbuild

### Key Features
- OAuth and PAT authentication: prompt → validate → persist (0600 perms on POSIX)
- List personal and organization repos with metadata (name, description, stars, forks, etc.)
- Full keyboard navigation with extensive shortcuts
- Background fetch-all: whole account loaded into the persisted cache after the first page
- Server-side search with Apollo Client caching
- Repository actions: delete, archive/unarchive, change visibility, sync forks
- Organization and Enterprise GitHub support
- Modal-based UI for sorting, filtering, and actions
- Persistent UI preferences (sort, density, visibility filter, fork tracking, colour theme)
- Real-time rate limit monitoring for GraphQL and REST APIs

### Planned Enhancements
See the living roadmap in [TODOs.md](./TODOs.md) for the canonical, up-to-date list. Key near-term items include:
- Repository renaming
- Bulk selection and actions
- Copy repository URL to clipboard
- Optional OS keychain support (via `keytar`)

## Configuration & Token Storage

- Reads token from `process.env.GITHUB_TOKEN` or `process.env.GH_TOKEN` first.
- Fallback to config file: created on first successful validation.
- Config path via `env-paths('gh-manager-cli').config`:
  - macOS: `~/Library/Preferences/gh-manager-cli/config.json`
  - Linux: `~/.config/gh-manager-cli/config.json`
  - Windows: `%APPDATA%\gh-manager-cli\config.json`
- Permissions:
  - POSIX: `chmod 600` after writing file.
- Shape:
  ```json
  { "token": "<pat>", "tokenVersion": 1 }
  ```
- PAT scopes:
  - For listing all personal repos including private: classic PAT with `repo` scope (read is sufficient).
  - If only public repos are needed, a token with public-repo read may suffice, but `repo` is recommended.

## GitHub API Details

- GraphQL query against `viewer.repositories` with `ownerAffiliations: OWNER` and `orderBy: UPDATED_AT DESC`.
- Page size: 100 per request (default; configurable 1-100 via `REPOS_PER_FETCH`).
- **Single pagination model — background fetch-all:** the first page renders immediately, then a background loop fetches every remaining page until `hasNextPage` is false, appending into the persisted cache. There is no scroll-position prefetch trigger for the owned/starred lists; the load is continuous and driven by the effect re-running as the list grows. (Server-side search remains lazy/per-query.)
- Because the full set is cached, **sorting is client-side** (`filteredAndSorted`) with no server refetch on sort change; archive/visibility (private) filtering is also client-side.
- On each page fetch, also read `totalCount` to reflect newly created repos and to show background-load progress (`loaded/total`).
- Selected fields: name/nameWithOwner/description/visibility/isPrivate/isFork/isArchived/stargazerCount/forkCount/primaryLanguage/updatedAt/pushedAt/diskUsage, plus `parent { nameWithOwner }` and `defaultBranchRef { name }`.
- **Light bulk query (SWR-360):** the list/search queries intentionally do NOT fetch per-repo commit history (`history.totalCount`). Computing that for each repo and its parent across 100 repos/page exceeds GitHub's per-query budget and returns HTTP 502. Consequently fork **"commits behind"** counts are not available from the bulk fetch — `parent { nameWithOwner }` still drives the "Fork of X" label, but the "(N behind)" indicator is populated by a separate on-demand enrichment pass (follow-up). `fetchRepositoryById` (single repo) still fetches the full history fields.

## Controls

- Up/Down: move selection
- PageUp/PageDown: jump ±10
- `Ctrl+G`: jump to top
- `G`: jump to bottom
- `/`: search mode (3+ characters for server-side search, Esc cancels)
- `S`: sort modal (updated, pushed, name, stars)
- `D`: toggle sort direction
- `T`: toggle display density (compact/cozy/comfy)
- `Shift+T`: cycle colour theme (Default → Ocean → Forest → Monochrome); persists across restarts
- `F`: toggle fork commit tracking
- `V`: visibility filter modal (All, Public, Private/Internal)
- `W`: organization switcher
- Enter or `O`: open selected repo in browser
- `I`: repository info modal
- `K`: cache inspection
- `Del` or `Backspace`: delete selected repo (two-stage confirmation)
- `Ctrl+A`: archive/unarchive selected repo
- `Ctrl+V`: change repository visibility
- `Ctrl+S`: sync fork with upstream
- `Ctrl+L`: logout (returns to Authentication Required)
- `Shift+S`: toggle between own repos and starred repos (personal context only)
  - Footer hint shows `Shift+S Starred` in normal mode and `Shift+S My Repos` in starred mode; hidden in org context
- `R`: refresh list (purges cache)
- `Q`: quit (Esc cancels an open modal or exits search mode; does not quit)

### Modal UX Convention (preferred)
- Left/Right: move focus between buttons (e.g., Delete, Cancel)
- Enter: run the currently focused button’s action
- `Y`: confirm (applies to any confirmation action)
- `C`: cancel (preferred); `Esc` also cancels

## Setup & Usage

Prereqs:
- Node.js >= 18
- pnpm

Install deps and build:

```bash
pnpm install
pnpm build
```

Run the CLI:

```bash
node dist/index.js
# or add to PATH (dev):
pnpm link # then run: gh-manager-cli
```

First run prompts for a PAT if not provided via env vars. The token is validated by a quick `viewer { login }` request; on success it’s stored in the config file with restricted permissions.

## Troubleshooting

- Invalid token:
  - Re-run and enter a valid PAT (recommended scope: `repo`).
- Rate-limited:
  - Wait or reduce page size; future enhancement will show rate-limit details.
- Network errors:
  - Check connectivity and retry with `r`.

## Security Notes

- The PAT is stored in plaintext in the user config directory with 0600 perms (POSIX). Consider revoking tokens when no longer needed.
- A future enhancement may integrate `keytar` to use the OS keychain for secrets.

## Scripts

- `pnpm build` — build to `dist/`
- `pnpm dev` — watch mode
- `pnpm start` — run `node dist/index.js`

## Packaging

- `package.json` defines `bin: { "gh-manager-cli": "dist/index.js" }`.
- For local dev: `pnpm link` exposes `gh-manager-cli` on PATH.
- For publish: `npm publish` (after setting version and adding README).

## Development Workflow

### Version Management
- **Format:** Semantic versioning (MAJOR.MINOR.PATCH)
- **Automation:** semantic-release handles version bumping and git tags
- **Release process:** Automated via GitHub Actions on main branch push
- **Change tracking:** All releases documented in [CHANGELOG.md](./CHANGELOG.md)

### Code Standards
- **TypeScript:** Strict mode with comprehensive type definitions
- **React/Ink:** Functional components with hooks
- **Terminal colours:** Use chalk for pre-colouring to avoid nested Text issues
- **Error handling:** Try-catch blocks for API calls and network operations
- **Language:** British English for all user-facing text (e.g., organisation, authorisation, colour)

### Testing Protocol
1. **Terminal Testing:** Test in multiple terminals (iTerm2, Terminal.app, Termius)
2. **API Testing:** Mock data for offline development
3. **UI Testing:** Various window sizes and content lengths
4. **Build Testing:** Ensure production build works correctly

## Git Management

### Branch Strategy
- **main:** Production-ready code only
- **Feature branches:** For new features and major changes

### Linear Issue Linking (REQUIRED)
Every change should trace back to a Linear issue. To guarantee GitHub ↔ Linear auto-linking:
- **Branch name MUST include the Linear issue ID**, e.g. `feature/swr-360-background-fetch-all` (`<type>/swr-<id>-<slug>`).
- **PR title MUST include the Linear issue ID**, e.g. `feat: background fetch-all pagination with light bulk query (SWR-360)`.
- If no Linear issue exists for the work yet, **create one first**, then name the branch and PR with its ID.
- This is what links the PR back to the Linear issue and surfaces progress there — do not open a PR without the ID in both places.

### Commit Message Format
**REQUIRED:** All commits MUST follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:** feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

**Examples:**
- `feat: add repository filtering by language`
- `fix: resolve spacing issues in terminal rendering`
- `docs: update installation instructions`
- `chore: update dependencies`
- `refactor: simplify RepoList component logic`

**Important:** Every commit message MUST use semantic format to ensure proper versioning and changelog generation.

### Automated Release Process
1. **PR Creation:** Titles automatically formatted to conventional commits
2. **Main Branch Push:** Triggers semantic-release workflow
3. **Version Calculation:** Based on commit types (feat = minor, fix = patch)
4. **CHANGELOG.md:** Generated automatically from commits
5. **GitHub Release:** Created with release notes
6. **NPM Publishing:** If configured with NPM_TOKEN

## Known Issues & Solutions

### Terminal Rendering Differences
- **Issue:** Spacing and line rendering varies between SSH (Termius) and native macOS Terminal
- **Cause:** Different ANSI escape sequence handling and Yoga layout engine interpretations
- **Current Solution:** Using chalk to pre-color strings before passing to single Text component
- **Ongoing:** Testing various spacing approaches (Box with minHeight, empty components)

### Key Code Patterns
```tsx
// Pre-color strings to avoid nested Text rendering issues
const coloredName = chalk.bold.cyan(repo.name);
const coloredDescription = chalk.gray(repo.description || 'No description');
const fullText = `${coloredName}\n${coloredDescription}\n${metadataLine}`;

// Use Box with minHeight for consistent spacing
<Box minHeight={2}>{/* Empty spacer */}</Box>
```

## Common Tasks

### Adding New Features
1. Create feature branch
2. Update relevant components in `src/`
3. Test across different terminals
4. Update TypeScript types if needed
5. Commit with conventional message
6. Create PR (title will be auto-formatted)

### Task Tracking
- The single source of truth for work items is [TODOs.md](./TODOs.md).
- Update TODOs when starting or completing work (use checkboxes).
- Keep README’s “Todo & Roadmap” section brief and point back to TODOs.md.

### Bug Fixes
1. Identify issue and create test case
2. Fix in relevant source file
3. Test fix across multiple terminals
4. Commit and push (version bumping and releases are automated)

### Updating Dependencies
```bash
pnpm update              # Update all to latest compatible
pnpm add package@latest  # Update specific package
pnpm build              # Ensure build still works
```

## Known Limitations

- **Terminal Compatibility:** Rendering differences between terminal emulators
- **Windows Support:** Untested, may have path/color issues
- **Large Repositories:** Performance with 1000+ repos needs optimization
- **Offline Mode:** No caching, requires internet connection

## Future Considerations

- **Repository Actions:** Clone, create, delete repos from CLI
- **Issue Management:** View and create issues
- **PR Management:** List and review pull requests
- **Caching:** Offline support with local data cache
- **Themes:** Customizable color schemes
- **Config Profiles:** Multiple GitHub account support

## Agent Guidelines

When working on this project:

1. **Always test changes** in multiple terminals before considering complete
2. **Use chalk for colors** instead of Ink's color props to avoid nesting issues
3. **Follow TypeScript strictly** - no any types without justification
4. **ALWAYS use semantic commit messages** - This is REQUIRED for every commit
5. **Update this file** when adding major features or changing architecture
6. **Consider terminal constraints** - not all ANSI features work everywhere
7. **Keep it fast** - terminal UIs should feel instant

### Commit Requirements
Every single commit MUST follow semantic format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation only
- `style:` for formatting, missing semicolons, etc.
- `refactor:` for code changes that neither fix bugs nor add features
- `perf:` for performance improvements
- `test:` for adding missing tests
- `build:` for changes to build system or dependencies
- `ci:` for CI configuration changes
- `chore:` for other changes that don't modify src or test files
- `revert:` for reverting previous commits

---

**📋 For version history and release notes, see [CHANGELOG.md](./CHANGELOG.md)**

*This file contains project architecture and development guidelines. Dynamic information like versions and changes are tracked automatically in CHANGELOG.md.*
