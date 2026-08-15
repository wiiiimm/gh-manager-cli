# Installation

The various ways to install and run gh-manager-cli, from package managers to standalone binaries.

## Homebrew (macOS/Linux)

```
brew tap wiiiimm/tap
brew install gh-manager-cli
```

## NPX (Recommended — No Installation Required)

```
npx gh-manager-cli@latest
```

## NPM Global Install

```
npm install -g gh-manager-cli@latest
gh-manager-cli
```

## Pre-built Binaries (No Node.js Required)

Download standalone executables from [GitHub Releases](https://github.com/wiiiimm/gh-manager-cli/releases):

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
