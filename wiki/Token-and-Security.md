# Token & Security

The app needs a GitHub token to read your repositories.

## Token Management

- Provide via env var: `GITHUB_TOKEN` or `GH_TOKEN`, or enter when prompted on first run.
- Recommended: classic PAT with `repo` scope for listing both public and private repos (read is sufficient).
- Validation: a minimal `viewer { login }` request verifies the token.
- Storage: token is saved as JSON in your OS user config directory with POSIX perms `0600`.
  - macOS: `~/Library/Preferences/gh-manager-cli/config.json`
  - Linux: `~/.config/gh-manager-cli/config.json`
  - Windows: `%APPDATA%\gh-manager-cli\config.json`
- Revocation: you can revoke the PAT at any time in your GitHub settings.

Note: Tokens are stored in plaintext on disk with restricted permissions. Future work may add OS keychain support.

## PAT Permissions & Scopes

Choose the least-privileged token for the features you plan to use:

- Browsing/searching repos (public only): `public_repo`
- Browsing/searching repos (includes private): `repo`
- Archive/Unarchive repository: `repo` (and you must have admin or maintainer rights on the repo)
- Sync fork with upstream: `repo` (you must have push rights to your fork)
- Delete repository: `delete_repo` (and admin rights on the repo)

## Additional Notes

- Organization repositories may require that your token is SSO-authorized if the org enforces SSO.
- If organization data doesn't appear in the switcher, ensure your token is authorized for that org and consider adding `read:org` (some org setups require it to list memberships).
- Fine-grained PATs: grant Repository access to the repos you need and enable at least:
  - Metadata: Read
  - Contents: Read (list/search), Read & Write (sync/archive)
  - Administration: Manage (only if you need delete)
  
If in doubt, the classic `repo` scope plus `delete_repo` (for deletion) is the simplest equivalent.

## Related Pages

- [Installation](Installation.md) - How to install gh-manager-cli
- [Features](Features.md) - Core features and capabilities
- [Troubleshooting](Troubleshooting.md) - Common issues and solutions

