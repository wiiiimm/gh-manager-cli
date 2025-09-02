# Installation

There are several ways to install and run gh-manager-cli:

## NPX (Recommended - No Installation Required)

Run instantly without installing:

```bash
npx gh-manager-cli
```

## NPM Global Install

Install globally for persistent `gh-manager-cli` command:

```bash
npm install -g gh-manager-cli
gh-manager-cli
```

## Pre-built Binaries (No Node.js Required)

Download standalone executables from [GitHub Releases](https://github.com/wiiiimm/gh-manager-cli/releases):

- **Linux**: `gh-manager-cli-linux-x64`
- **macOS**: `gh-manager-cli-macos-x64` 
- **Windows**: `gh-manager-cli-windows-x64.exe`

Make the binary executable (Linux/macOS):
```bash
chmod +x gh-manager-cli-*
./gh-manager-cli-*
```

## From Source

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

## Next Steps

- [Token & Security](Token-and-Security.md) - Set up authentication
- [Features](Features.md) - Explore available features
- [Usage](Usage.md) - Learn how to use the CLI

