# GitHub Sponsorship Platforms Guide

This document lists all the sponsorship platforms supported by GitHub's FUNDING.yml configuration file for the gh-manager-cli project.

## Currently Enabled Platforms

### GitHub Sponsors
- **Platform:** `github`
- **Username:** `wiiiimm`
- **Type:** Recurring monthly sponsorships
- **Description:** GitHub's native sponsorship platform, integrated directly into the GitHub experience
- **Best for:** Regular supporters who want to contribute monthly

## Available Platforms to Enable

### 1. Ko-fi (Buy Me Coffee Alternative)
- **Platform:** `ko_fi`
- **Type:** One-time donations and subscriptions
- **Description:** Popular micro-donation platform, great alternative to "Buy Me a Coffee"
- **Configuration:** Add your Ko-fi username to the `ko_fi` field
- **Example:** `ko_fi: your-username`

### 2. Custom URLs (Including Buy Me a Coffee)
- **Platform:** `custom`
- **Type:** Any custom funding URL (max 4 URLs)
- **Supported platforms via custom URLs:**
  - **Buy Me a Coffee:** `https://buymeacoffee.com/your-username`
  - **PayPal:** `https://www.paypal.me/your-username`
  - **Donorbox:** `https://donorbox.org/campaign-name`
  - **Stripe Payment Links**
  - **Crypto wallet addresses**
- **Configuration:**
  ```yaml
  custom:
    - https://buymeacoffee.com/your-username
    - https://www.paypal.me/your-username
  ```

### 3. Patreon
- **Platform:** `patreon`
- **Type:** Subscription-based funding with tiers
- **Description:** Popular platform for creator subscriptions with reward tiers
- **Configuration:** `patreon: your-username`

### 4. Open Collective
- **Platform:** `open_collective`
- **Type:** Transparent community funding
- **Description:** Open source focused platform with transparent financial tracking
- **Configuration:** `open_collective: your-project-name`

### 5. Tidelift
- **Platform:** `tidelift`
- **Type:** Enterprise open source funding
- **Description:** Platform focused on enterprise adoption of open source projects
- **Configuration:** `tidelift: npm/package-name` (format: ecosystem/package-name)

### 6. Community Bridge
- **Platform:** `community_bridge`
- **Type:** Linux Foundation backed funding
- **Description:** Funding platform operated by the Linux Foundation
- **Configuration:** `community_bridge: your-project-name`

### 7. Liberapay
- **Platform:** `liberapay`
- **Type:** European recurring donations
- **Description:** European-based platform for recurring donations, privacy-focused
- **Configuration:** `liberapay: your-username`

### 8. IssueHunt
- **Platform:** `issuehunt`
- **Type:** Issue and PR bounties
- **Description:** Platform for funding specific GitHub issues and pull requests
- **Configuration:** `issuehunt: your-username`

### 9. Otechie
- **Platform:** `otechie`
- **Type:** Technical consulting
- **Description:** Platform for technical consulting and project funding
- **Configuration:** `otechie: your-username`

## How to Enable Additional Platforms

1. **Edit the FUNDING.yml file:** `/path/to/repo/.github/FUNDING.yml`
2. **Uncomment the desired platform** and add your username/project name
3. **For custom URLs:** Add up to 4 custom funding URLs under the `custom` section
4. **Commit and push** the changes to enable the "Sponsor" button on GitHub

## Platform Recommendations

### For Individual Developers:
- **GitHub Sponsors** (recurring support)
- **Ko-fi** or **Buy Me a Coffee** (one-time donations)
- **PayPal** (familiar to most users)

### For Open Source Projects:
- **GitHub Sponsors** (project-focused)
- **Open Collective** (transparent finances)
- **Tidelift** (enterprise users)

### For Content Creators:
- **Patreon** (subscription tiers)
- **Ko-fi** (fan support)
- **Custom links** (multiple options)

## Testing Your Configuration

After adding the FUNDING.yml file:
1. The "Sponsor" button should appear on your repository's main page
2. Clicking it will show all configured funding options
3. Users can choose their preferred platform to support the project

## File Location

The FUNDING.yml file must be located at: `.github/FUNDING.yml` in your repository root.