# gh-manager-cli

[![npm version](https://img.shields.io/npm/v/gh-manager-cli.svg)](https://www.npmjs.com/package/gh-manager-cli)
[![GitHub release](https://img.shields.io/github/release/wiiiimm/gh-manager-cli.svg)](https://github.com/wiiiimm/gh-manager-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/gh-manager-cli.svg)](https://nodejs.org)
[![GitHub Stars](https://img.shields.io/github/stars/wiiiimm/gh-manager-cli.svg)](https://github.com/wiiiimm/gh-manager-cli/stargazers)
[![Context Engineered with Claude Opus 4.1](https://img.shields.io/badge/Context%20Engineered%20with-Claude%20Opus%204.1-blue)](https://www.anthropic.com)
[![Context Engineered with Codex GPT-5](https://img.shields.io/badge/Context%20Engineered%20with-Codex%20GPT--5-green)](https://openai.com)

Interactive terminal app to browse and manage your personal GitHub repositories. Built with Ink (React for CLIs) and the GitHub GraphQL API.

## 🧹 Stop Clicking Through GitHub's Web Interface

**Managing repos on github.com is painfully slow.** Every action requires multiple clicks, page loads, and navigating through buried settings menus. With hundreds of repos, it becomes impossible.

`gh-manager-cli` is the terminal alternative to GitHub's web UI:

### Why Terminal > Web Browser
| GitHub.com Frustrations | gh-manager-cli Solution |
|------------------------|------------------------|
| 📄 20 repos per page, endless clicking "Next" | ♾️ Smooth infinite scroll through all repos |
| 🖱️ Click repo → Settings → scroll → click action | ⌨️ Single keypress for any action |
| 🚫 No way to bulk archive or delete | 📦 Batch operations on multiple repos |
| 🔄 Full page refresh after every action | ⚡ Instant updates with no reload |
| 🔍 Basic search, can't filter by activity | 🎯 Smart filters by date, size, fork status |

**Result:** Clean up 50+ repos in 5 minutes instead of an hour of clicking

<p align="center">
  <img src="../docs/app-demo.gif" alt="Interactive demo of gh-manager-cli" width="900" />
  <br />
  <em>Fast, keyboard-first GitHub repo management from your terminal</em>
 </p>

## Screenshots

<div align="center">
  <img src="../docs/demo_repo_listing.png" alt="Repository listing with metadata" width="31%" />
  <img src="../docs/demo_login.png" alt="GitHub token authentication flow" width="31%" />
  <img src="../docs/demo_delete_confirmation.png" alt="Two-step delete confirmation" width="31%" />
  <br />
  <sub>Listing • Auth • Delete confirmation</sub>
</div>

## Documentation

- [Installation](Installation.md) - How to install gh-manager-cli
- [Features](Features.md) - Core features and capabilities
- [Usage](Usage.md) - How to use the CLI and keyboard shortcuts
- [Token & Security](Token-and-Security.md) - Authentication and security information
- [Development](Development.md) - Development workflow and technical details
- [Troubleshooting](Troubleshooting.md) - Common issues and solutions
- [Roadmap](Roadmap.md) - Upcoming features and enhancements

## Quick Start

```bash
# Run with npx (no install)
npx gh-manager-cli
```

On first run, you'll be prompted for a GitHub Personal Access Token.

