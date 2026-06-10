# Token & Security

How gh-manager-cli authenticates with GitHub and how your token is stored and secured.

See also: [Installation](Installation.md) · [Usage](Usage.md) · [Troubleshooting](Troubleshooting.md)

The app supports two authentication methods.

## 1. GitHub OAuth (Recommended)

The easiest and most secure way to authenticate:

- **Device Flow:** no need to handle callback URLs — just enter a code on GitHub's website.
- **Browser-based:** opens GitHub's authorisation page automatically.
- **Secure:** no client secrets or sensitive data in the app.
- **Full Permissions:** automatically requests all necessary scopes for complete functionality.
- **User-friendly:** no manual token management required.

When you first run the app, select "GitHub OAuth (Recommended)" from the authentication options. The app will:

1. Display a device code for you to enter on GitHub.
2. Open your browser to GitHub's device authorisation page.
3. Wait for you to authorise the app.
4. Securely store the OAuth token for future use.

## 2. Personal Access Token (PAT)

Alternative method for users who prefer manual token management:

- **Provide via env var:** `GITHUB_TOKEN` or `GH_TOKEN`, or enter when prompted on first run.
- **Recommended:** classic PAT with `repo` scope for listing both public and private repos.
- **Validation:** a minimal `viewer { login }` request verifies the token.

## Token Storage & Security

- **Storage:** tokens are saved as JSON in your OS user config directory with POSIX perms `0600`.
  - macOS: `~/Library/Preferences/gh-manager-cli/config.json`
  - Linux: `~/.config/gh-manager-cli/config.json`
  - Windows: `%APPDATA%\gh-manager-cli\config.json`
- **Revocation:** you can revoke tokens at any time in your GitHub settings.
- **Note:** tokens are stored in plaintext on disk with restricted permissions. Future work may add OS keychain support.

## PAT Permissions & Scopes

Choose the least-privileged token for the features you plan to use:

- **Browsing/searching repos (public only):** `public_repo`
- **Browsing/searching repos (includes private):** `repo`
- **Archive/Unarchive repository:** `repo` (and you must have admin or maintainer rights on the repo)
- **Sync fork with upstream:** `repo` (you must have push rights to your fork)
- **Delete repository:** `delete_repo` (and admin rights on the repo)

Notes:

- Organisation repositories may require that your token is SSO-authorised if the organisation enforces SSO.
- If organisation data doesn't appear in the switcher, ensure your token is authorised for that organisation and consider adding `read:org` (some organisation setups require it to list memberships).
- **Fine-grained PATs:** grant Repository access to the repos you need and enable at least: Metadata: Read; Contents: Read (list/search), Read & Write (sync/archive); Administration: Manage (only if you need delete). If in doubt, the classic `repo` scope plus `delete_repo` (for deletion) is the simplest equivalent.

## Related Pages

- [Installation](Installation.md)
- [Usage](Usage.md)
- [Troubleshooting](Troubleshooting.md)
