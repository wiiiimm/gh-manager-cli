# npm Scope Migration to Stealth Factory

The canonical package name is changing from `gh-manager-cli` to `@stealth-factory/gh-manager-cli`. This is a new npm package identity, not an in-place rename. Existing unscoped versions stay available.

The source repository is [stealth-factory/gh-manager-cli](https://github.com/stealth-factory/gh-manager-cli); the Homebrew tap is [stealth-factory/homebrew-tap](https://github.com/stealth-factory/homebrew-tap).

## Compatibility

- The installed executable stays `gh-manager-cli`.
- New documentation uses `npx @stealth-factory/gh-manager-cli@latest`.
- New unscoped releases become compatibility launchers, keeping `npx gh-manager-cli@latest` working.
- The launcher depends on the exact same version of the scoped package and forwards arguments in the same Node process.
- Saved tokens, UI preferences, cache, and logs retain their existing application paths.
- Personal sponsorship links remain those of the maintainer.

See [Installation](../wiki/Installation.md) for switching global npm and Homebrew installations.

## Before the First Scoped Release

1. Confirm the release account can publish public packages in the existing `stealth-factory` npm organisation.
2. If the scoped package does not exist yet, bootstrap it with an interactive npm publication, then configure npm trusted publishers on both package identities. Follow [npm Trusted Publishing](NPM_TRUSTED_PUBLISHING.md) for exact fields and bootstrap commands.
3. Check GitHub Actions secrets after the repository transfer: release commits and tap writes use `GH_TOKEN`; npmjs publication uses OIDC and requires no `NPM_TOKEN`.
4. Verify GitHub Packages permissions for the new organisation and the tap token's access to `stealth-factory/homebrew-tap`.
5. Run the automated checks and inspect both packed artifacts.
6. Merge with a release-triggering conventional title, including the Linear issue ID, such as `fix: migrate npm publication to stealth-factory (GMC-54)`.

`publishConfig` explicitly sets public access and the npmjs registry, so the scoped package is not accidentally published as private. Semantic-release continues from the repository's existing release tags and calculates the next version.

These repository changes prepare the migration. They do not themselves prove the new npm package has been published or that external permissions have been configured.

## Verify the Released Packages

After the release workflow succeeds:

```bash
npm view @stealth-factory/gh-manager-cli version repository.url --registry=https://registry.npmjs.org
npm view gh-manager-cli version dependencies --registry=https://registry.npmjs.org
npx @stealth-factory/gh-manager-cli@latest --version
npx gh-manager-cli@latest --version
```

Both commands should print the same release version. The unscoped package should depend on that exact scoped version.

Then verify the GitHub release binaries and the Homebrew formula. Its URL must point at the scoped npmjs tarball, with the checksum from the downloaded archive. See [HOMEBREW.md](HOMEBREW.md).

## Recover a Failed Compatibility Publication

Use a checkout of the release tag whose scoped version was already published. Confirm its version first:

```bash
node -p "require('./package.json').version"
npm view @stealth-factory/gh-manager-cli version --registry=https://registry.npmjs.org
pnpm legacy:prepare
npm pack ./.release/legacy --dry-run
```

Once the artifact and publishing account are checked, publish only the missing compatibility version:

```bash
npm publish ./.release/legacy --access public --registry=https://registry.npmjs.org
```

This local recovery command requires interactive npm authentication (`npm login --registry=https://registry.npmjs.org`) and any required 2FA. CI's OIDC credential is not available in a local shell. Do not add an npm publishing secret back to the workflow for recovery.

If that unscoped version already exists, inspect it before proceeding; npm versions cannot be overwritten. Do not unpublish the original package, and do not deprecate all unscoped versions while the short command is supported.

## References

- [npm scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [npm package transfer limitations](https://docs.npmjs.com/transferring-a-package-from-a-user-account-to-another-user-account/)
- [npm Trusted Publishing](NPM_TRUSTED_PUBLISHING.md)
- [Release Process](RELEASE_PROCESS.md)
