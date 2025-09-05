# Roadmap

This page outlines the planned features and enhancements for gh-manager-cli. For the most up-to-date task board, see [TODOs.md](../TODOs.md).

## Recently Implemented

- ✅ **OAuth login flow** as alternative to Personal Access Token
- ✅ **Density toggle** for row spacing (compact/cozy/comfy)
- ✅ **Repo actions** (archive/unarchive, delete, change visibility) with confirmations
- ✅ **Organization support** and switching (press `W`) with enterprise detection
- ✅ **Enhanced server-side search** with improved UX and organization context
- ✅ **Smart infinite scroll** with 80% prefetch trigger
- ✅ **Modal-based sort and visibility filtering**
- ✅ **GitHub Enterprise support** with Internal repository visibility
- ✅ **Change repository visibility** (`Ctrl+V`)
- ✅ **Server-side visibility filtering** for accurate pagination
- ✅ **Sync fork with upstream** (`Ctrl+S`)
- ✅ **Repository info modal** (`I` key)
- ✅ **Cache inspection** (`K` key)
- ✅ **Logout functionality** (`Ctrl+L`)
- ✅ **Apollo Client caching** with persistent storage
- ✅ **Rate limit monitoring** for GraphQL and REST APIs with delta tracking
- ✅ **Repository renaming** (`Ctrl+R`) with inline validation and cache update
- ✅ **Copy repository URL to clipboard** (`C` key) with SSH/HTTPS options

## In Progress

- 🔄 **Automated test suite**
  - Test infrastructure setup (Vitest with TypeScript support)
  - Added `pnpm test` script for running tests
  - Unit tests for utilities and components
  - Integration tests for key workflows

## Coming Soon

- ⭐ **Stars mode** (Personal Account only)
  - View repositories you've starred
  - Available only when viewing Personal Account
  - Unstar repositories directly from the list
  - GraphQL query to fetch starred repositories

- 📋 **Bulk selection and actions**
  - Multi-select mode with space to toggle selection
  - Bulk operations (archive/unarchive, delete)
  - Progress tracking and status reporting

## Future Considerations

- 🔮 **Language filter and indicators**
- 🔮 **Extended CLI flags** (`--sort`, `--filter`, `--page-size` - partial implementation exists)
- 🔮 **Extended repo metadata** (license, topics, issues count, watchers)
- 🔮 **Repository actions** (clone, create repos from CLI)
- 🔮 **Issue management** (view and create issues)
- 🔮 **PR management** (list and review pull requests)
- 🔮 **Themes** (customizable color schemes)
- 🔮 **Config profiles** (multiple GitHub account support)

## Related Pages

- [Features](Features.md) - Current feature set
- [Development](Development.md) - Development workflow and technical details
- [Testing](Testing.md) - Testing documentation

