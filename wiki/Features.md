# Features

gh-manager-cli provides a comprehensive set of features for managing your GitHub repositories:

## Core Repository Management

- **Token Authentication**: Secure PAT storage with validation and persistence
- **Repository Listing**: Browse all your personal repositories with metadata (stars, forks, language, etc.)
- **Live Pagination**: Infinite scroll with automatic page prefetching
- **Interactive Sorting**: Modal-based sort selection (updated, pushed, name, stars) with direction toggle
- **Smart Search**: Server-side search through repository names and descriptions (3+ characters)
- **Visibility Filtering**: Modal-based visibility filter (All, Public, Private, Internal for enterprise) with server-side filtering
- **Fork Status Tracking**: Toggle display of commits behind upstream for forked repositories
- **Repository Actions**:
  - View detailed info (`I`) - Shows repository metadata, language, size, and timestamps
  - Open in browser (Enter/`O`)
  - Delete repository (`Del` or `Backspace`) with secure two-step confirmation
  - Archive/unarchive repositories (`Ctrl+A`) with confirmation prompts
  - Sync forks with upstream (`Ctrl+S`) with automatic conflict detection

## User Interface & Experience

- **Keyboard Navigation**: Full keyboard control (arrow keys, PageUp/Down, `Ctrl+G`/`G`)
- **Display Density**: Toggle between compact/cozy/comfy spacing (`T`)
- **Visual Indicators**: Fork status, private/archived badges, language colors, visibility status
- **Interactive Modals**: Sort selection, visibility filtering, and organization switching via modal dialogs
- **Balanced Layout**: Repository items with spacing above and below for better visual hierarchy
- **Loading States**: Contextual loading screens for sorting and refreshing operations
- **Rate Limit Monitoring**: Live API usage display with visual warnings
- **Improved Layout**: Balanced spacing above and below repository items for better visual hierarchy

## Technical Features

- **Preference Persistence**: UI settings (sort, density, visibility filter, fork tracking) saved between sessions
- **Server-side Filtering**: Visibility filtering performed at GitHub API level for accurate pagination
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Secure Storage**: Token stored with proper file permissions (0600)
- **Error Handling**: Graceful error recovery with retry mechanisms
- **Performance**: Efficient GraphQL queries with virtualized rendering and server-side filtering
- **Apollo Cache**: Built-in caching to reduce API calls and improve performance

## Related Pages

- [Usage](Usage.md) - How to use these features
- [Token & Security](Token-and-Security.md) - Authentication details
- [Development](Development.md) - Technical implementation details
- [Roadmap](Roadmap.md) - Upcoming features

