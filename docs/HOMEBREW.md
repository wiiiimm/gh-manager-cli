# Homebrew Installation

## For Users

Once gh-manager-cli is accepted into homebrew-core:

```bash
brew install gh-manager-cli
```

## For Maintainers

See [HOMEBREW_SUBMISSION.md](./HOMEBREW_SUBMISSION.md) for:
- Initial submission to homebrew-core
- Version bumps and updates
- Automation setup

## Quick Version Bump

After a new npm release:

```bash
# 1. Get SHA256 for new version
bash scripts/brew-sha.sh 1.12.0

# 2. Submit bump PR to homebrew-core
brew bump-formula-pr \
  --url="https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-1.12.0.tgz" \
  --sha256="SHA256_FROM_STEP_1" \
  gh-manager-cli
```