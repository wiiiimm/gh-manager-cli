# Homebrew Core Submission Guide for gh-manager-cli

## Prerequisites

Before submitting to homebrew-core, ensure:
- ✅ The package is published to npm
- ✅ The `--version` flag works without network calls
- ✅ The package has a stable release (not a pre-release)

## Step 1: Get the SHA256 for Current Release

```bash
# For the latest published version
npm view gh-manager-cli version  # Check what's on npm
bash scripts/brew-sha.sh 1.11.1  # Use the npm version
```

## Step 2: Create the Formula

1. Fork https://github.com/Homebrew/homebrew-core
2. Clone your fork locally
3. Create a new branch: `git checkout -b gh-manager-cli-new-formula`
4. Create the formula file at `Formula/g/gh-manager-cli.rb`:

```ruby
require "language/node"

class GhManagerCli < Formula
  desc "Interactive CLI to manage GitHub repositories"
  homepage "https://github.com/wiiiimm/gh-manager-cli"
  url "https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-1.11.1.tgz"
  sha256 "REPLACE_WITH_SHA256_FROM_STEP_1"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/gh-manager-cli --version")
  end
end
```

## Step 3: Test Locally

```bash
# From the homebrew-core directory
cd $(brew --repository homebrew/core)

# Test the formula
brew style --fix Formula/g/gh-manager-cli.rb
brew install --build-from-source Formula/g/gh-manager-cli.rb
brew test gh-manager-cli
brew audit --new-formula gh-manager-cli
```

## Step 4: Submit the Pull Request

1. Commit with message: `gh-manager-cli 1.11.1 (new formula)`
2. Push to your fork
3. Create PR to homebrew-core with title: `gh-manager-cli 1.11.1 (new formula)`

PR Description template:
```
- [x] Have you followed the [guidelines for contributing](https://github.com/Homebrew/homebrew-core/blob/HEAD/CONTRIBUTING.md)?
- [x] Have you ensured that your commits follow the [commit style guide](https://docs.brew.sh/Formula-Cookbook#commit)?
- [x] Have you built your formula locally with `brew install --build-from-source <formula>`?
- [x] Have you run `brew audit --new-formula <formula>` (for new formulae)?
- [x] Have you run `brew test <formula>`?

This PR adds gh-manager-cli, an interactive terminal UI for managing GitHub repositories.

- **Homepage**: https://github.com/wiiiimm/gh-manager-cli
- **npm package**: https://www.npmjs.com/package/gh-manager-cli
- **Source**: npm tarball using Language::Node
- **Test**: Uses `--version` flag (no network required)
```

## Step 5: Future Updates (After Initial Acceptance)

Once the formula is in homebrew-core, use the bump command for updates:

```bash
# Get SHA for new version
bash scripts/brew-sha.sh 1.12.0

# Create bump PR automatically
brew bump-formula-pr \
  --url="https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-1.12.0.tgz" \
  --sha256="NEW_SHA256_HERE" \
  gh-manager-cli
```

## Automation for Future Releases

Add to `.github/workflows/release.yml`:

```yaml
- name: Create Homebrew bump PR
  if: github.event_name == 'release'
  run: |
    VERSION="${{ github.event.release.tag_name }}"
    VERSION="${VERSION#v}"  # Remove 'v' prefix if present
    SHA256=$(bash scripts/brew-sha.sh "$VERSION" | grep "sha256:" | cut -d' ' -f2)
    
    # Create an issue in your repo to track the bump
    gh issue create \
      --title "Bump Homebrew formula to $VERSION" \
      --body "New version $VERSION released. SHA256: $SHA256
      
      Run this command to submit to homebrew-core:
      \`\`\`bash
      brew bump-formula-pr \\
        --url='https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-$VERSION.tgz' \\
        --sha256='$SHA256' \\
        gh-manager-cli
      \`\`\`"
```

## Important Notes

1. **Do NOT include the formula in your repo** - It belongs in homebrew-core only
2. **Version must match npm** - The formula version must match what's published
3. **Be patient** - Initial review can take days/weeks
4. **Follow feedback** - Homebrew maintainers may request changes
5. **Test thoroughly** - Broken formulae reflect poorly on the project

## Common Issues

- **Formula style**: Run `brew style --fix` before submitting
- **Test failures**: Ensure `--version` works without a GitHub token
- **Audit issues**: Address all `brew audit` warnings
- **Node version**: Formula works with the current Homebrew node version