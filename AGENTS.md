# AGENTS.md - gh-manager-cli Project Memory & Instructions

## Project Overview

**gh-manager-cli** is an interactive CLI tool built with Ink (React for terminals) that helps users manage GitHub repositories. This project provides a terminal-based UI for browsing, searching, and managing personal GitHub repos with real-time API integration.

### Current Status: Active Development
- ✅ Core repository listing functionality
- ✅ GitHub GraphQL API integration  
- ✅ Interactive terminal UI with Ink
- ✅ Token management and secure storage
- ✅ Infinite scroll and pagination
- ✅ Semantic release automation and CI/CD workflows
- ✅ Automated changelog generation and PR title management
- 🔧 UI spacing consistency across terminals (ongoing)
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
- Token bootstrap: prompt → validate → persist (0600 perms on POSIX)
- List personal repos with metadata (name, description, stars, forks, etc.)
- Keyboard navigation (Up/Down, PageUp/PageDown, g/G, r, q/Esc)
- Infinite scroll with automatic pagination
- Real-time totalCount refresh to reflect new repos

### Planned Enhancements
See the living roadmap in [TODOs.md](./TODOs.md) for the canonical, up-to-date list. Key near-term items include:
- Density toggle (row spacing) with persisted preference
- Repo actions (archive/unarchive, delete) with confirmations
- Organization switcher and org listing
- Server-side search and first-page cache
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
- Page size: 50 per request.
- On each page fetch, also read `totalCount` to reflect newly created repos.
- Selected fields: name/nameWithOwner/description/visibility/isPrivate/isFork/isArchived/stargazerCount/forkCount/primaryLanguage/updatedAt/pushedAt/diskUsage.

## Controls

- Up/Down: move selection
- PageUp/PageDown: jump ±10
- `g` (Ctrl+g): jump to top
- `G`: jump to bottom
- `r`: refresh
- `q` or Esc: quit
- Enter: reserved for future actions

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
pnpm link # then run: gh-manager
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

- `package.json` defines `bin: { "gh-manager": "dist/index.js" }`.
- For local dev: `pnpm link` exposes `gh-manager` on PATH.
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
- **Terminal colors:** Use chalk for pre-coloring to avoid nested Text issues
- **Error handling:** Try-catch blocks for API calls and network operations

### Testing Protocol
1. **Terminal Testing:** Test in multiple terminals (iTerm2, Terminal.app, Termius)
2. **API Testing:** Mock data for offline development
3. **UI Testing:** Various window sizes and content lengths
4. **Build Testing:** Ensure production build works correctly

## Git Management

### Branch Strategy
- **main:** Production-ready code only
- **Feature branches:** For new features and major changes

### Commit Message Format
Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:
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
4. **Maintain semantic commits** for proper versioning
5. **Update this file** when adding major features or changing architecture
6. **Consider terminal constraints** - not all ANSI features work everywhere
7. **Keep it fast** - terminal UIs should feel instant

---

**📋 For version history and release notes, see [CHANGELOG.md](./CHANGELOG.md)**

*This file contains project architecture and development guidelines. Dynamic information like versions and changes are tracked automatically in CHANGELOG.md.*
