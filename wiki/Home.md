# gh-manager-cli

[![npm version](https://img.shields.io/npm/v/gh-manager-cli.svg)](https://www.npmjs.com/package/gh-manager-cli)
[![GitHub release](https://img.shields.io/github/release/wiiiimm/gh-manager-cli.svg)](https://github.com/wiiiimm/gh-manager-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/gh-manager-cli.svg)](https://nodejs.org)
[![GitHub Stars](https://img.shields.io/github/stars/wiiiimm/gh-manager-cli.svg)](https://github.com/wiiiimm/gh-manager-cli/stargazers)

Interactive terminal app to browse and manage your GitHub repositories. Built with Ink (React for CLIs) and the GitHub GraphQL API.

This is the documentation wiki. For the project overview, see the [main README](../README.md).

<p align="center">
  <img src="../docs/app-demo.gif" alt="Interactive demo of gh-manager-cli" width="900" />
  <br />
  <em>Fast, keyboard-first GitHub repo management from your terminal</em>
 </p>

## Documentation

- [Installation](Installation.md) — how to install gh-manager-cli
- [Features](Features.md) — core features and capabilities
- [Usage & Controls](Usage.md) — CLI flags, keyboard shortcuts, and the session summary
- [Token & Security](Token-and-Security.md) — authentication, token storage, and PAT scopes
- [Development](Development.md) — development workflow, release process, and project layout
- [Testing](Testing.md) — testing documentation
- [Apollo Cache](Apollo-Cache.md) — caching behaviour and configuration
- [Logging](Logging.md) — log locations and what's logged
- [Troubleshooting](Troubleshooting.md) — common issues and solutions
- [Roadmap & Feature Requests](Roadmap.md) — how to request features and what's being considered

## Quick Start

```bash
# Run with npx (no install)
npx gh-manager-cli@latest
```

On first run, you'll be prompted to authenticate with GitHub (OAuth recommended). See [Token & Security](Token-and-Security.md).
