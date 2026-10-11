import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const registry = 'https://registry.npmjs.org/';
const scopedName = '@stealth-factory/gh-manager-cli';

// Also used by the recovery command: pnpm legacy:prepare.
export function createLegacyPackage(root, version) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.name !== scopedName) {
    throw new Error(`Expected the canonical package to be ${scopedName}`);
  }
  const releaseVersion = version ?? pkg.version;
  const directory = join(root, '.release', 'legacy');
  mkdirSync(directory, { recursive: true });
  const legacy = {
    name: 'gh-manager-cli',
    version: releaseVersion,
    description: `Compatibility launcher for ${scopedName}`,
    license: pkg.license,
    type: 'module',
    bin: { 'gh-manager-cli': 'index.js' },
    files: ['index.js', 'README.md', 'LICENSE'],
    engines: pkg.engines,
    dependencies: { [scopedName]: releaseVersion },
    repository: pkg.repository,
    bugs: pkg.bugs,
    homepage: pkg.homepage,
    publishConfig: { access: 'public', registry },
  };
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify(legacy, null, 2)}\n`);
  writeFileSync(join(directory, 'index.js'), `#!/usr/bin/env node\nimport '${scopedName}';\n`, { mode: 0o755 });
  writeFileSync(join(directory, 'README.md'), `# gh-manager-cli\n\nCompatibility launcher for [${scopedName}](https://www.npmjs.com/package/${scopedName}).\n\nBoth commands launch the same version of the interactive GitHub repository manager:\n\n\`\`\`sh\nnpx gh-manager-cli@latest\nnpx ${scopedName}@latest\n\`\`\`\n\nFor new installations, use the scoped package. The installed command remains \`gh-manager-cli\`.\n\nDocumentation: https://github.com/stealth-factory/gh-manager-cli\n`);
  copyFileSync(join(root, 'LICENSE'), join(directory, 'LICENSE'));
  return directory;
}

export function prepare(_config, { cwd, nextRelease, logger }) {
  createLegacyPackage(cwd, nextRelease.version);
  logger.log('Prepared gh-manager-cli compatibility launcher for %s', nextRelease.version);
}

// Ordered after @semantic-release/npm so the exact scoped dependency exists first.
export function publish(_config, { cwd, nextRelease, logger }) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'publish', '--access', 'public', '--registry', registry,
    '--tag', nextRelease.channel || 'latest',
  ], { cwd: join(cwd, '.release', 'legacy'), stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Failed to publish the gh-manager-cli compatibility launcher');
  logger.log('Published gh-manager-cli compatibility launcher for %s', nextRelease.version);
  return {
    name: 'npm compatibility launcher',
    url: `https://www.npmjs.com/package/gh-manager-cli/v/${nextRelease.version}`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(createLegacyPackage(process.cwd()));
}
