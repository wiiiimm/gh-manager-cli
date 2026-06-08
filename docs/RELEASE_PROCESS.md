# Release Process Documentation

## Overview
The gh-manager-cli project uses a **single optimized workflow** for all releases to minimize complexity and avoid skipped workflow runs.

## Architecture: Two-Phase Workflow Approach

```
┌─────────────────────────────────────────────────────────────┐
│                         Main Branch                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Phase 1: Version Creation (Non-release commits)             │
│  ─────────────────────────────────────────────────           │
│  [Feature/Fix Commit] ──► [release.yml workflow]             │
│                              │                               │
│                              ▼                               │
│                    ┌──────────────────┐                      │
│                    │ Semantic Release │                      │
│                    │ - Analyze commits│                      │
│                    │ - Bump version   │                      │
│                    │ - Update CHANGELOG│                     │
│                    │ - Create git tag │                      │
│                    │ - NPM Publish    │                      │
│                    │ - Commit changes │                      │
│                    └────────┬─────────┘                      │
│                             │                                │
│                             ▼                                │
│                    Creates "chore(release):" commit          │
│                                                               │
│  Phase 2: Binary Building (Release commits)                  │
│  ───────────────────────────────────────────                 │
│  [chore(release): commit] ──► [release.yml workflow]         │
│                                   │                          │
│                                   ▼                          │
│                          ┌────────────────┐                  │
│                          │ Build Binaries │                  │
│                          │ (Linux/Mac/Win)│                  │
│                          └────────┬───────┘                  │
│                                   │                          │
│                          ┌────────▼───────────┐              │
│                          │ Create GitHub      │              │
│                          │ Release & Upload   │              │
│                          │ Binaries           │              │
│                          └────────┬───────────┘              │
│                                   │                          │
│                          ┌────────▼───────────┐              │
│                          │ Publish to GitHub  │              │
│                          │ Packages & Update  │              │
│                          │ Homebrew Formula   │              │
│                          └────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Why Two-Phase Workflow?

### Benefits
1. **Correct Version in Binaries**: Build happens after version is committed
2. **Avoids Immutable Release Issues**: GitHub release created after binaries are ready
3. **Clear Separation**: Version creation vs binary building
4. **Atomic Operations**: Each phase completes independently

### How It Works
- **Phase 1**: Runs on feature/fix commits to create version and publish to npm
- **Phase 2**: Runs on `chore(release):` commits to build binaries and create GitHub release
- This ensures binaries contain the correct version number

## Release Triggers

The workflow runs on every push to main and determines if a release is needed based on:

### Semantic Commit Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Release-Triggering Commit Types
- `feat:` - New feature (minor version bump)
- `fix:` - Bug fix (patch version bump)
- `perf:` - Performance improvement (patch version bump)
- `BREAKING CHANGE:` - Breaking change (major version bump)

### Non-Release Commit Types
- `chore:` - Maintenance tasks
- `docs:` - Documentation only
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `ci:` - CI/CD changes

## Release Flow

### Phase 1: Version Creation
1. **Developer Action**: Push feature/fix to main
2. **Workflow Triggers**: `release.yml` starts
3. **Semantic Release Job**: (if NOT `chore(release):`)
   - Analyzes all commits since last release
   - Determines version bump (major/minor/patch)
   - Updates package.json and CHANGELOG.md
   - Creates git tag
   - Publishes to NPM
   - Commits changes as `chore(release): X.Y.Z`

### Phase 2: Binary Building
1. **Automatic Trigger**: `chore(release):` commit from Phase 1
2. **Workflow Triggers**: `release.yml` starts again
3. **Build Jobs**: (if `chore(release):`)
   - Build binaries for Linux, macOS, Windows
   - Uses committed version from package.json
4. **Create Release Job**:
   - Creates GitHub Release with changelog
   - Uploads binaries to release
5. **Publish Extras Job**:
   - Publishes to GitHub Packages
   - Updates Homebrew formula

## Version Numbering

Uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

## Configuration Files

### `package.json` (release config)
```json
{
  "release": {
    "branches": ["main"],
    "plugins": [
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
      "@semantic-release/changelog",
      "@semantic-release/npm",
      ["@semantic-release/git", {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
      }]
    ]
  }
}
```
Note: `@semantic-release/github` is NOT included to avoid immutable release issues.

### Workflow: `.github/workflows/release.yml`
- Single workflow handling all release logic
- Uses job-level conditions to avoid skipped runs
- Outputs clear success/failure status

## Manual Release

If needed, you can trigger a release manually:
```bash
npm run release
```

This runs semantic-release locally (requires proper tokens).

## Troubleshooting

### Release Not Triggering
- Check commit message format
- Ensure commits follow semantic conventions
- Verify no `chore(release):` prefix

### Version Not Bumping Correctly
- Review commit types since last release
- Check for `BREAKING CHANGE:` in commit body
- Verify `.releaserc.json` configuration

## Deleted Workflows

The following redundant workflows were removed:
1. `automated-release.yml` - Replaced by single workflow
2. `release-on-version-change.yml` - Never performed useful work

## Best Practices

1. **Use Semantic Commits**: Always follow the commit format
2. **PR Titles Matter**: When squash-merging, PR title becomes commit message
3. **Breaking Changes**: Document in commit body with `BREAKING CHANGE:`
4. **Direct Commits**: Okay for quick fixes, workflow handles both cases