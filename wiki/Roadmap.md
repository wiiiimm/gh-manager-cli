# Roadmap

This page outlines the planned features and enhancements for gh-manager-cli. For the most up-to-date task board, see [TODOs.md](../TODOs.md).

## Recently Implemented

- ✅ **Density toggle** for row spacing (compact/cozy/comfy)
- ✅ **Repo actions** (archive/unarchive, delete) with confirmations
- ✅ **Organization support** and switching (press `W`)
- ✅ **Enhanced server-side search** with improved UX
- ✅ **Smart infinite scroll** with 80% prefetch trigger
- ✅ **Modal-based sort and visibility filtering**
- ✅ **Server-side visibility filtering** for accurate pagination
- ✅ **Sync fork with upstream** (`Ctrl+S`)
- ✅ **Repository info modal** (`I` key)
- ✅ **Cache inspection** (`Ctrl+I`)
- ✅ **Logout functionality** (`Ctrl+L`)
- ✅ **Apollo Client caching** with persistent storage

## In Progress

- 🔄 **Automated test suite**
  - Test infrastructure setup (Vitest with TypeScript support)
  - Added `pnpm test` script for running tests
  - Unit tests for utilities and components
  - Integration tests for key workflows

## Coming Soon

- 📋 **Repository renaming**
  - Assign a key to trigger rename (e.g., `E`)
  - Modal overlay with text input prefilled with current repo name
  - Update repository name via GitHub API

- 📋 **Bulk selection and actions**
  - Multi-select mode with space to toggle selection
  - Bulk operations (archive/unarchive, delete)
  - Progress tracking and status reporting

- 📋 **OS keychain support**
  - Optional storage via `keytar`
  - Fallback to file with 0600 permissions

- 📋 **Window resize handling**
  - Recompute layout on terminal resize
  - Keep selection visible

- 📋 **Copy repository URL to clipboard**
  - SSH and HTTPS URL options
  - Cross-platform clipboard support

## Future Considerations

- 🔮 **OAuth login flow** (alternative to token)
- 🔮 **Toggle repository visibility** (public/private/internal)
- 🔮 **Language filter and indicators**
- 🔮 **CLI flags** (e.g., `--org`, `--sort`, `--filter`, `--page-size`)
- 🔮 **Extended repo metadata** (license, topics, issues count, watchers)
- 🔮 **Repository actions** (clone, create, delete repos from CLI)
- 🔮 **Issue management** (view and create issues)
- 🔮 **PR management** (list and review pull requests)
- 🔮 **Caching** (offline support with local data cache)
- 🔮 **Themes** (customizable color schemes)
- 🔮 **Config profiles** (multiple GitHub account support)

## Related Pages

- [Features](Features.md) - Current feature set
- [Development](Development.md) - Development workflow and technical details
- [Testing](Testing.md) - Testing documentation

