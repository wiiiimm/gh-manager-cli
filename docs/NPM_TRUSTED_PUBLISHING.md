# npm Trusted Publishing

The npmjs release job in `.github/workflows/release.yml` uses GitHub Actions OIDC instead of a stored `NPM_TOKEN`. GitHub supplies the workflow identity; npm exchanges it for a short-lived publishing credential for each package. `GH_TOKEN` remains necessary for release commits and Homebrew tap pushes, and the separate GitHub Packages job still uses `GITHUB_TOKEN`.

## Configure Both Packages on npm

Open **Settings → Trusted publishing** for each package:

- [`@stealth-factory/gh-manager-cli`](https://www.npmjs.com/package/@stealth-factory/gh-manager-cli) — the canonical application.
- [`gh-manager-cli`](https://www.npmjs.com/package/gh-manager-cli) — the compatibility launcher that keeps `npx gh-manager-cli` working.

Add a **GitHub Actions** trusted publisher with these exact values:

| Field | Value |
|---|---|
| Organisation or user | `stealth-factory` |
| Repository | `gh-manager-cli` |
| Workflow filename | `release.yml` |
| Environment | Leave empty; the release job does not use a GitHub environment |
| Allowed actions | Enable direct publishing with `npm publish` |

The workflow filename is not the display name “Release Pipeline” and does not include `.github/workflows/`. Configuring one package does not authorise the other. An old publisher pointing at `wiiiimm/gh-manager-cli` must be replaced with a connection for the transferred repository.

New trusted publisher connections must complete their first successful publish within two days. If a connection expires, recreate it before releasing. See the [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) for current requirements.

## Bootstrap a New Scoped Package

npm requires the package to exist before a trusted publisher can be configured. If `npm view @stealth-factory/gh-manager-cli --registry=https://registry.npmjs.org` returns 404, an npm organisation member with publishing access must first publish the built canonical package interactively:

```bash
pnpm install
pnpm build
npm pack --dry-run
npm login --registry=https://registry.npmjs.org
npm publish --access public --registry=https://registry.npmjs.org
```

Use the reviewed migration checkout and its existing version; do not bump the version or edit `CHANGELOG.md` for this bootstrap. The scoped name is a separate identity, so publishing its existing version does not overwrite the unscoped package. Review the packed files before publishing, and complete npm's interactive authentication and 2FA prompts.

After the initial publication, configure its trusted publisher and the existing unscoped package's publisher, then merge the OIDC workflow change. The next releasable commit lets semantic-release calculate and publish the next version of both packages.

The bootstrap uses local interactive authentication. It does not require a long-lived npm secret in GitHub Actions.

## Workflow Behaviour

- The npmjs job requests `id-token: write` on a GitHub-hosted Ubuntu runner.
- Node 22 and pinned npm 11.19.0 support trusted publishing. Semantic-release's npm plugin already supports OIDC.
- Keep `publishConfig.registry` exactly `https://registry.npmjs.org/`, including the trailing slash: the installed semantic-release npm plugin uses an exact comparison to select OIDC.
- A dedicated, token-free npm configuration replaces setup-node's authentication placeholder before dependencies are installed and releases run. The job does not reference `NPM_TOKEN` or `NODE_AUTH_TOKEN` secrets.
- The canonical package publishes first through `@semantic-release/npm`; the compatibility plugin then runs `npm publish` for its own package identity using the same workflow's OIDC environment.
- Public packages published from this public repository through OIDC receive npm's automatic provenance attestations.

Do not substitute `GH_TOKEN` as an npm credential. Its GitHub permissions do not authenticate against npmjs.

## Verify and Recover

After a successful run, verify both versions and the compatibility dependency using [npm Scope Migration](NPM_SCOPE_MIGRATION.md). Local tests cannot prove the npm package-side trust configuration is correct; the actual publish verifies it.

If OIDC exchange fails, check both package configurations, the exact owner/repository/workflow values, direct publishing permission, connection expiry, and the job's `id-token: write` permission. An `EINVALIDNPMTOKEN` after a failed OIDC exchange does not mean CI needs a stored npm token: semantic-release may have fallen back to token authentication after OIDC was rejected.

For a compatibility publication that fails after the canonical version is live, use the exact release checkout and the recovery instructions in [npm Scope Migration](NPM_SCOPE_MIGRATION.md). That manual command requires local npm authentication; OIDC credentials exist only inside the authorised Actions job.
