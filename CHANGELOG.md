## [1.10.2](https://github.com/wiiiimm/gh-manager-cli/compare/v1.10.1...v1.10.2) (2025-09-01)


### Bug Fixes

* handle GitHub API 422 status for sync-upstream as potential success ([9a13e8a](https://github.com/wiiiimm/gh-manager-cli/commit/9a13e8a76d4ed09eb7af18b5b8de9e0f2d4c978f))

## [1.10.1](https://github.com/wiiiimm/gh-manager-cli/compare/v1.10.0...v1.10.1) (2025-09-01)


### Bug Fixes

* keep sync and delete modals open on error for better UX ([1823076](https://github.com/wiiiimm/gh-manager-cli/commit/1823076bdd74c2cb50591d9133eabe4a96927cea))

# [1.10.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.9.0...v1.10.0) (2025-09-01)


### Features

* sync repository actions with Apollo cache and improve info view ([563d04a](https://github.com/wiiiimm/gh-manager-cli/commit/563d04a4ec931c27dff204d3b5e6e770e4b482e6))

# [1.9.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.8.2...v1.9.0) (2025-09-01)


### Features

* refetch repository data after sync to update timestamps ([b26468d](https://github.com/wiiiimm/gh-manager-cli/commit/b26468de5c3c12e04199f13de1958acd725fd239))

## [1.8.2](https://github.com/wiiiimm/gh-manager-cli/compare/v1.8.1...v1.8.2) (2025-09-01)


### Bug Fixes

* update search results when performing repository actions ([f4edb65](https://github.com/wiiiimm/gh-manager-cli/commit/f4edb65d84501f894dcc012bc6bf6b7495ec0902))

## [1.8.1](https://github.com/wiiiimm/gh-manager-cli/compare/v1.8.0...v1.8.1) (2025-09-01)


### Bug Fixes

* prevent duplicate npm publishing when version hasn't changed ([ff0b37b](https://github.com/wiiiimm/gh-manager-cli/commit/ff0b37b99c4232fa2d179a9becf6e314cc218d55))

# [1.8.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.7.0...v1.8.0) (2025-08-31)


### Features

* implement organization support feature ([#1](https://github.com/wiiiimm/gh-manager-cli/issues/1)) ([5a404b2](https://github.com/wiiiimm/gh-manager-cli/commit/5a404b29cdd3a30bd12b59438e0c3fd978da93b9))

# [1.7.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.6.2...v1.7.0) (2025-08-31)


### Features

* implement smarter infinite scroll prefetch trigger at 80% ([d124b94](https://github.com/wiiiimm/gh-manager-cli/commit/d124b9483196fe703ccffaea1ffdecef9cca31a5))

## [1.6.2](https://github.com/wiiiimm/gh-manager-cli/compare/v1.6.1...v1.6.2) (2025-08-31)


### Bug Fixes

* resolve ES module import issues and improve search UX ([2a08c6b](https://github.com/wiiiimm/gh-manager-cli/commit/2a08c6b557c5a00e1005136074273e38c817a4c3))

## [1.6.1](https://github.com/wiiiimm/gh-manager-cli/compare/v1.6.0...v1.6.1) (2025-08-31)


### Bug Fixes

* correct GitHub Packages publishing in workflow ([191fcd5](https://github.com/wiiiimm/gh-manager-cli/commit/191fcd503389cb09774305ebde58481cccc9e518))

# [1.6.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.5.0...v1.6.0) (2025-08-31)


### Bug Fixes

* make cache inspection visible in terminal ([2030466](https://github.com/wiiiimm/gh-manager-cli/commit/2030466e1b2bf377a22e07eba5a0334b9c3a6bc5))


### Features

* add Apollo cache debugging and verification tools ([e4828c4](https://github.com/wiiiimm/gh-manager-cli/commit/e4828c4463b6ebb58f419f6e6e17c06c699b31ac))
* add cache testing scripts and environment template ([2b4d840](https://github.com/wiiiimm/gh-manager-cli/commit/2b4d840f0a32a4089c47bca9664ac393e824643a))
* add repository info modal and always-on Apollo cache ([aecfd31](https://github.com/wiiiimm/gh-manager-cli/commit/aecfd311feaf5e674d2f8f15062f12d6deffcfe5))

# [1.5.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.4.2...v1.5.0) (2025-08-31)


### Features

* add fork sync functionality and update documentation ([1d37a10](https://github.com/wiiiimm/gh-manager-cli/commit/1d37a10d90636731c436679b0a4ff2d1c3e1daae))

## [1.4.2](https://github.com/wiiiimm/gh-manager-cli/compare/v1.4.1...v1.4.2) (2025-08-31)


### Bug Fixes

* add packages permission and improve GitHub Packages publishing with jq ([2346944](https://github.com/wiiiimm/gh-manager-cli/commit/2346944739f70d237240c6d67ae39c32d1d623d5))

## [1.4.1](https://github.com/wiiiimm/gh-manager-cli/compare/v1.4.0...v1.4.1) (2025-08-31)


### Bug Fixes

* correct GitHub Packages publishing step ([6a8122a](https://github.com/wiiiimm/gh-manager-cli/commit/6a8122ad32308cbd8e3cbf07176608fe3639887d))

# [1.4.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.3.0...v1.4.0) (2025-08-31)


### Features

* add GitHub Packages publishing to release workflow ([0cc2052](https://github.com/wiiiimm/gh-manager-cli/commit/0cc2052591d01717fbdaf7d844f2b210c3013341))

# [1.3.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.2.0...v1.3.0) (2025-08-31)


### Features

* **auth:** add Logout modal (Ctrl+L) with confirm/cancel; return to Authentication Required on confirm; fix modalOpen; center footer; clarify fork metric labels; refine key handling (case-insensitive, Ctrl+G/G separation); clear screen on quit; set page size to 5 (dev)/15 (prod) ([7a6a0fb](https://github.com/wiiiimm/gh-manager-cli/commit/7a6a0fb8767986b8640371e483f0fc5a084e75a2))

# [1.2.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.1.1...v1.2.0) (2025-08-31)


### Features

* add npx support as primary installation method ([eeae1c8](https://github.com/wiiiimm/gh-manager-cli/commit/eeae1c8e60f0b4bd1f3076a16b65aec01cf5afdf))
* re-enable NPM publishing and update installation docs ([e6d5cff](https://github.com/wiiiimm/gh-manager-cli/commit/e6d5cffc64678899ecc89cf294c4413fab4cdf66))

## [1.1.1](https://github.com/wiiiimm/gh-manager-cli/compare/v1.1.0...v1.1.1) (2025-08-31)


### Bug Fixes

* temporarily disable NPM publishing due to 2FA requirement ([2ab09ca](https://github.com/wiiiimm/gh-manager-cli/commit/2ab09ca8d543c771f97c999ad6beb6ebf36747be))

# [1.1.0](https://github.com/wiiiimm/gh-manager-cli/compare/v1.0.0...v1.1.0) (2025-08-31)


### Features

* re-enable NPM publishing with NPM_TOKEN configured ([a0c3520](https://github.com/wiiiimm/gh-manager-cli/commit/a0c3520ca53092941d4a761d6f94a66a500753dd))

# 1.0.0 (2025-08-31)


### Bug Fixes

* **delete:** use GitHub REST API DELETE /repos/{owner}/{repo} with token; update UI and docs accordingly ([e921ab9](https://github.com/wiiiimm/gh-manager-cli/commit/e921ab9917e27d368fc73f326bbe98081386ca18))
* resolve pnpm lockfile compatibility in CI workflow ([ece890f](https://github.com/wiiiimm/gh-manager-cli/commit/ece890f9b8d1b0c91dcb8cf1ab9275537483ea4f))
* update GitHub Actions workflow to use pnpm instead of npm ([42a0269](https://github.com/wiiiimm/gh-manager-cli/commit/42a02698d1490cf9f562633eddca86f0c54d10a3))
* update pkg targets to use node18 instead of node20 ([6302567](https://github.com/wiiiimm/gh-manager-cli/commit/6302567f15076e177dbad875f87c363ea5679486))


### Features

* add fork sync, improved error handling, and UI enhancements ([165e03e](https://github.com/wiiiimm/gh-manager-cli/commit/165e03e983feb15f2d08301b59d125717b3ba937))
* add logout functionality with Ctrl+L shortcut ([f51c8b8](https://github.com/wiiiimm/gh-manager-cli/commit/f51c8b85c8890b063812a734a9c01651478fa4e2))
* add repository visibility toggle TODO item ([0b42fa0](https://github.com/wiiiimm/gh-manager-cli/commit/0b42fa04721209add85dc2dca4339ed5b1ffd79e))
* add server-side sorting and loading screens ([a082410](https://github.com/wiiiimm/gh-manager-cli/commit/a082410dcbd7125957b0fa9b3982d29eed53317a))
* complete fork tracking system with comprehensive improvements ([4621e10](https://github.com/wiiiimm/gh-manager-cli/commit/4621e1025d603acf14defb031c4d36de21c11846))
* disable NPM publishing temporarily to focus on binary releases ([df7718d](https://github.com/wiiiimm/gh-manager-cli/commit/df7718d324ec52e244b9176101aedc5f56a5a22d))
* implement automated release workflow with compiled binaries ([195ca17](https://github.com/wiiiimm/gh-manager-cli/commit/195ca174857eeef9ce08b6bbfce03ab61f185aa8))
* initial commit with semantic release setup ([62c4919](https://github.com/wiiiimm/gh-manager-cli/commit/62c4919c1c9061f7a5153c2a363398c9d571e9db))
* **prefs:** persist UI preferences (s/d/t) in config; load on startup ([bba426a](https://github.com/wiiiimm/gh-manager-cli/commit/bba426a0321e652d74c0dd5d340ff26cc3b98283))
* **ui:** add Delete Confirmation title and side-by-side buttons with shortcut hints in modal ([2073fd2](https://github.com/wiiiimm/gh-manager-cli/commit/2073fd277506c6f802c1dd46142900597a16c3f1))
* **ui:** centered delete modal with dimmed list (B-center); increase padding; show confirmation code as placeholder ([04434ba](https://github.com/wiiiimm/gh-manager-cli/commit/04434ba92ad621b1c68985bf3a61e3094f21aa5d))
* **ui:** density toggle, delete modal with 2-step confirm, centered modal; docs and TODOs updates; dim UI during modal ([27f90c7](https://github.com/wiiiimm/gh-manager-cli/commit/27f90c7e7ba096798bb0b930a3cf707f04218671))


### Performance Improvements

* reduce production page size from 25 to 15 ([168c79a](https://github.com/wiiiimm/gh-manager-cli/commit/168c79a0b69704c7c29fb8c95e039127e9b50d6d))
