# Optional Homebrew Core Submission

The maintained distribution is the [Stealth Factory tap](https://github.com/stealth-factory/homebrew-tap). Its transfer does not mean the formula has been accepted into homebrew-core. Use [HOMEBREW.md](HOMEBREW.md) for current installation and release maintenance.

If proposing the formula to homebrew-core in future, follow Homebrew's current [contribution guidelines](https://docs.brew.sh/How-To-Open-a-Homebrew-Pull-Request) and [Formula Cookbook](https://docs.brew.sh/Formula-Cookbook).

## Prepare the Formula

Use a stable, published version of `@stealth-factory/gh-manager-cli`:

```bash
VERSION=$(npm view @stealth-factory/gh-manager-cli version --registry=https://registry.npmjs.org)
bash scripts/brew-sha.sh "$VERSION"
```

Start from `Formula/gh-manager-cli.rb` in `stealth-factory/homebrew-tap`, with:

- Homepage: `https://github.com/stealth-factory/gh-manager-cli`.
- Source: the scoped npm tarball URL printed by `brew-sha.sh`.
- SHA256: the checksum of that published tarball.
- Executable: `gh-manager-cli`.
- Test: `gh-manager-cli --version`, which does not require authentication or network access.

Install the proposed formula into your homebrew-core fork and run the checks requested by Homebrew:

```bash
brew style --fix Formula/g/gh-manager-cli.rb
brew install --build-from-source Formula/g/gh-manager-cli.rb
brew test gh-manager-cli
brew audit --new-formula gh-manager-cli
```

Keep third-party formula changes in the tap or homebrew-core checkout, rather than this CLI repository.

## Future Core Version Bumps

Only after acceptance into homebrew-core, use its bump flow:

```bash
VERSION=$(npm view @stealth-factory/gh-manager-cli version --registry=https://registry.npmjs.org)
SHA256=$(bash scripts/brew-sha.sh "$VERSION" | awk '/^sha256:/ {print $2}')
brew bump-formula-pr \
  --url="https://registry.npmjs.org/@stealth-factory/gh-manager-cli/-/gh-manager-cli-${VERSION}.tgz" \
  --sha256="$SHA256" \
  gh-manager-cli
```

The current release workflow updates the Stealth Factory tap; it does not submit homebrew-core pull requests.
