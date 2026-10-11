# Installation

The various ways to install and run gh-manager-cli, from package managers to standalone binaries.

The canonical npm package is `gh-manager-cli`, maintained by Stealth Factory. The executable remains `gh-manager-cli`.

## Homebrew (macOS/Linux)

```
brew tap stealth-factory/tap https://github.com/stealth-factory/homebrew-tap
brew install stealth-factory/tap/gh-manager-cli
```

The tap is hosted at [stealth-factory/homebrew-tap](https://github.com/stealth-factory/homebrew-tap); use the explicit URL to keep the familiar `tap` alias for this repository.

If you previously installed from `wiiiimm/tap`, switch with:

```bash
brew uninstall gh-manager-cli
brew untap wiiiimm/tap
brew tap stealth-factory/tap https://github.com/stealth-factory/homebrew-tap
brew install stealth-factory/tap/gh-manager-cli
```

Your saved authentication, preferences, and cache use the same application paths after reinstalling.

## NPX (Recommended — No Installation Required)

```
npx gh-manager-cli@latest
```

The unscoped package contains the application directly.

## NPM Global Install

```
npm install -g gh-manager-cli@latest
gh-manager-cli
```

If you installed the scoped package during the migration, switch back with:

```bash
npm uninstall -g @stealth-factory/gh-manager-cli
npm install -g gh-manager-cli@latest
gh-manager-cli
```

The previously published scoped version remains available, but new npm releases use `gh-manager-cli`.

## Pre-built Binaries (No Node.js Required)

Download standalone executables from [GitHub Releases](https://github.com/stealth-factory/gh-manager-cli/releases):

- **Linux:** `gh-manager-cli-linux-x64`
- **macOS:** `gh-manager-cli-macos-x64`
- **Windows:** `gh-manager-cli-windows-x64.exe`

Make the binary executable (Linux/macOS):

```
chmod +x gh-manager-cli-*
./gh-manager-cli-*
```

## From Source

**Prerequisites:** Node.js 22.12+, pnpm.

Install and build:

```
git clone https://github.com/stealth-factory/gh-manager-cli.git
cd gh-manager-cli
pnpm install
pnpm build
```

Run locally:

```
node dist/index.js
# Or add to PATH for dev
pnpm link
gh-manager-cli
```

On first run, you'll be prompted to authenticate with GitHub (OAuth recommended). See [Token & Security](Token-and-Security.md).

## Related Pages

- [Usage](Usage.md)
- [Features](Features.md)
- [Token & Security](Token-and-Security.md)
