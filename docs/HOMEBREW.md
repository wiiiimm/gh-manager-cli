# Homebrew Installation and Tap Maintenance

The project tap is [stealth-factory/homebrew-tap](https://github.com/stealth-factory/homebrew-tap). It is separate from homebrew-core.

## Installation

```bash
brew tap stealth-factory/tap https://github.com/stealth-factory/homebrew-tap
brew install stealth-factory/tap/gh-manager-cli
gh-manager-cli
```

The explicit repository URL lets Homebrew use the `stealth-factory/tap` alias. For existing `wiiiimm/tap` installations, see the [installation migration steps](../wiki/Installation.md).

## Release Automation

After npm publication and the binary release, `.github/workflows/release.yml` updates `Formula/gh-manager-cli.rb` in `stealth-factory/homebrew-tap`.

- Download the published `gh-manager-cli` tarball and calculate its SHA256.
- Replace either the previous unscoped URL or an existing scoped URL with the unscoped tarball URL.
- Update the checksum and the GitHub homepage.
- Commit and push using `GH_TOKEN`, which needs write access to the transferred tap.

A missing `GH_TOKEN` or a rejected push fails the job. If the formula already matches the release, the job succeeds without another commit or push.

Do not hash a locally packed tarball: the checksum must match the exact archive served by npm. The download script fails on HTTP errors, so a missing release cannot become a bogus checksum.

## Manual Tap Update

From the CLI repository root, after the unscoped version has been published:

```bash
git clone https://github.com/stealth-factory/homebrew-tap.git homebrew-tap
bash scripts/update-homebrew-tap.sh
```

For an existing checkout or a specific published version:

```bash
VERSION=$(npm view gh-manager-cli version --registry=https://registry.npmjs.org)
bash scripts/update-homebrew-tap.sh /path/to/homebrew-tap "$VERSION"
```

The script updates the formula locally and prints the commit/push steps. Review and test it from the tap checkout before pushing:

```bash
brew style Formula/gh-manager-cli.rb
brew reinstall --build-from-source stealth-factory/tap/gh-manager-cli
brew test stealth-factory/tap/gh-manager-cli
```

To inspect the checksum and download URL only:

```bash
bash scripts/brew-sha.sh "$VERSION"
```

The npm archive URL has this shape:

```text
https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-X.Y.Z.tgz
```

For an optional future homebrew-core submission, see [HOMEBREW_SUBMISSION.md](HOMEBREW_SUBMISSION.md). For the npm migration and credentials, see [NPM_SCOPE_MIGRATION.md](NPM_SCOPE_MIGRATION.md).
