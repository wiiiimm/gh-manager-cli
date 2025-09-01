Homebrew (homebrew-core) Packaging Plan
======================================

This guide walks you through submitting gh-manager-cli to Homebrew core and maintaining it.

1) Prepare a Stable Release
- Ensure the CLI prints a version without network: `gh-manager-cli --version`.
- Publish to npm (semantic-release already handles npm on tag). Confirm the tarball exists:
  - https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-<version>.tgz

2) Compute the SHA256 of the npm tarball
```bash
VERSION=$(node -e "console.log(require('./package.json').version)")
URL="https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-${VERSION}.tgz"
curl -L -o gh-manager-cli.tgz "$URL"
shasum -a 256 gh-manager-cli.tgz
```

3) Create the Formula
- Fork https://github.com/Homebrew/homebrew-core
- Add a new file at `Formula/g/gh-manager-cli.rb` (note the `g/` subdir) with contents adapted from `docs/formula/gh-manager-cli.rb`.
- Replace the `sha256` placeholder with the value from step 2.

4) Validate Locally
```bash
brew style --fix ./gh-manager-cli.rb
brew install --build-from-source --formula ./gh-manager-cli.rb
brew audit --new-formula --online gh-manager-cli
gh-manager-cli --version
```

5) Open the PR to homebrew-core
- Commit message: `gh-manager-cli <version> (new formula)`
- PR notes:
  - Formula name: gh-manager-cli
  - Source: npm tarball + `Language::Node.std_npm_install_args`
  - Depends on node; test uses `--version` (no network)

6) Maintain the Formula
- On each release, open a bump PR:
```bash
brew bump-formula-pr \
  --url "https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-<version>.tgz" \
  --sha256 "<new_sha256>" gh-manager-cli
```

Notes
- homebrew-core CI might request style/audit adjustments — follow their feedback.
- Keep tests network-free; `--version` is sufficient.
- If your org enforces SSO, that does not affect brew testing as no network call is made.

