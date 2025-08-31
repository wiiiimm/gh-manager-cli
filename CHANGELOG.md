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
