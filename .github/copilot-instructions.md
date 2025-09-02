# GitHub Copilot Instructions for gh-manager-cli

## Project Overview

**gh-manager-cli** is an interactive CLI tool built with Ink (React for terminals) that helps users manage GitHub repositories. This project provides a terminal-based UI for browsing, searching, and managing personal GitHub repos with real-time API integration.

### Key Technologies
- **Node.js + TypeScript** - Core runtime and type safety
- **Ink** - React for terminal UIs (NOT standard React)
- **Chalk** - Terminal string styling (preferred over Ink's color props)
- **GraphQL** - GitHub API v4 integration
- **Vitest** - Testing framework

### Current Status: Active Development
- ✅ Core repository listing functionality
- ✅ GitHub GraphQL API integration  
- ✅ Interactive terminal UI with Ink
- ✅ Token management and secure storage
- ✅ Infinite scroll and pagination
- ✅ Semantic release automation and CI/CD workflows
- 🔧 UI spacing consistency across terminals (ongoing)
- 🔧 Cross-terminal rendering optimization

## Architecture

### Repository Structure
```
src/
├── index.tsx              # Main entry point and app component
├── types.ts               # TypeScript type definitions
├── github.ts              # GitHub GraphQL API client
├── config.ts              # Configuration and token management
├── constants.ts           # App constants and OAuth config
├── oauth.ts               # OAuth device flow implementation
├── utils.ts               # Utility functions
└── ui/
    ├── components/
    │   ├── modals/        # Modal dialogs (Info, Delete, Sync, etc.)
    │   ├── RepoList.tsx   # Main repository list component
    │   ├── FilterInput.tsx # Search/filter input component
    │   └── LoadingSpinner.tsx # Loading indicator
    └── hooks/
        └── useKeyHandler.tsx # Keyboard event handling
```

### Key Features
- **Repository Management**: List, filter, sort, archive/unarchive, delete repos
- **Authentication**: Personal Access Token (PAT) or OAuth device flow
- **Interactive UI**: Keyboard navigation, modals, real-time updates
- **Infinite Scroll**: Efficient pagination with GitHub's GraphQL API
- **Cross-terminal Support**: Tested on macOS Terminal, SSH clients, various emulators

## Critical Development Guidelines

### 1. Terminal UI Constraints (VERY IMPORTANT)
- **Use Chalk for colors** instead of Ink's color props to avoid nested Text rendering issues
- **Terminal rendering varies** between SSH (Termius) and native terminals
- **Test in multiple terminals** before considering changes complete
- **Keep UI fast** - terminal UIs should feel instant

### 2. Code Patterns
```tsx
// ✅ CORRECT: Pre-color strings to avoid nested Text rendering issues
const coloredName = chalk.bold.cyan(repo.name);
const coloredDescription = chalk.gray(repo.description || 'No description');
const fullText = `${coloredName}\n${coloredDescription}\n${metadataLine}`;

// ✅ CORRECT: Use Box with minHeight for consistent spacing
<Box minHeight={2}>{/* Empty spacer */}</Box>

// ❌ WRONG: Nested Text components with color props
<Text color="cyan"><Text bold>{repo.name}</Text></Text>
```

### 3. TypeScript Requirements
- **Strict TypeScript** - no `any` types without justification
- **Type imports** - use `import type` for type-only imports
- **Interface definitions** - define clear interfaces for all data structures

### 4. GitHub API Integration
- **GraphQL preferred** for data fetching (queries in `src/github.ts`)
- **REST API for mutations** (delete, archive operations)
- **Pagination** using GraphQL cursors, not REST page numbers
- **Rate limiting** considerations - implement smart retry logic

## Commit Message Requirements (MANDATORY)

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

## UI/UX Guidelines

### Keyboard Controls
- **Navigation**: Up/Down arrows, PageUp/PageDown, Ctrl+G (top), G (bottom)
- **Actions**: Enter/O (open), Del (delete), Ctrl+A (archive), R (refresh)
- **Modals**: Left/Right (button focus), Y (confirm), C/Esc (cancel)
- **Filter**: / (enter filter mode), Enter (apply), Esc (cancel)

### Modal UX Convention
- Left/Right: move focus between buttons (e.g., Delete, Cancel)
- Enter: run the currently focused button's action
- Y: confirm (applies to any confirmation action)
- C: cancel (preferred); Esc also cancels

## Known Issues & Solutions

### Terminal Rendering Differences
- **Issue**: Spacing and line rendering varies between SSH and native terminals
- **Cause**: Different ANSI escape sequence handling and Yoga layout engine interpretations
- **Solution**: Use chalk to pre-color strings before passing to single Text component
- **Ongoing**: Testing various spacing approaches (Box with minHeight, empty components)

### Security Considerations
- **Token Storage**: PAT stored in plaintext with 0600 permissions in user config
- **Scopes**: Recommend `repo` scope for full functionality, `delete_repo` for deletion
- **OAuth**: Device flow implementation for better UX (alternative to PAT)

## Testing Strategy

### Manual Testing Requirements
- **Multiple Terminals**: Test in native terminal AND SSH client
- **Different Sizes**: Test various terminal window sizes
- **Edge Cases**: Empty repositories, network failures, rate limits
- **Keyboard Navigation**: Verify all controls work consistently

### Automated Testing
- **Vitest**: Unit tests for utilities and components
- **Type Checking**: Strict TypeScript compilation
- **Linting**: ESLint for code quality

## Common Tasks

### Adding New Features
1. Create feature branch with descriptive name
2. Update relevant components in `src/`
3. Test across different terminals and window sizes
4. Update TypeScript types if needed
5. Add tests if test infrastructure exists
6. Commit with semantic message format
7. Update documentation if architecture changes

### Bug Fixes
1. Identify issue and create test case (if possible)
2. Fix in relevant source file with minimal changes
3. Test fix across multiple terminals
4. Commit with semantic message (`fix: description`)

### API Changes
- **GraphQL queries**: Update in `src/github.ts`
- **Type definitions**: Update `src/types.ts`
- **Error handling**: Follow existing patterns for network/API errors

## Development Workflow

### Build & Run
```bash
npm install          # Install dependencies
npm run build       # Build to dist/
npm run dev         # Watch mode for development
node dist/index.js  # Run the CLI
npm link            # For global access: gh-manager-cli
```

### Scripts
- `npm run build` - Build to `dist/`
- `npm run dev` - Watch mode
- `npm run start` - Run `node dist/index.js`
- `npm test` - Run test suite

## Performance Considerations

### Terminal UI Performance
- **Minimize re-renders**: Use React.memo and useMemo appropriately
- **Efficient scrolling**: Virtualization for large repository lists
- **Network optimization**: Smart caching and batch operations
- **Responsive UI**: Loading states and optimistic updates

### GitHub API Efficiency
- **GraphQL queries**: Fetch only needed fields
- **Pagination**: Use cursors, reasonable page sizes
- **Caching**: Implement smart caching for static data
- **Rate limiting**: Respect GitHub's rate limits

## Future Considerations

- **Repository Actions**: Clone, create repos from CLI
- **Issue Management**: View and create issues
- **PR Management**: List and review pull requests  
- **Caching**: Offline support with local data cache
- **Themes**: Customizable color schemes
- **Config Profiles**: Multiple GitHub account support
- **Windows Support**: Full testing and compatibility

## Important Files to Reference

- **AGENTS.md**: Complete project documentation and guidelines
- **TODOs.md**: Living roadmap and task tracking
- **CHANGELOG.md**: Version history and release notes
- **wiki/**: Feature documentation and troubleshooting guides

When working on this project, always prioritize terminal compatibility and user experience. The goal is to create a fast, reliable, and intuitive CLI tool that works consistently across different terminal environments.