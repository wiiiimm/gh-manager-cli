import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');
const directories: string[] = [];

// Execute the actual workflow's shell blocks offline. Their env expressions
// are outside the run blocks; the fixture supplies those values explicitly.
function runBlock(name: string) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  if (start === -1) throw new Error(`Missing workflow step: ${name}`);
  const next = workflow.indexOf('      - name:', start + 1);
  const step = workflow.slice(start, next === -1 ? undefined : next);
  const block = step.split('        run: |\n')[1];
  if (!block) throw new Error(`Missing run block: ${name}`);
  return block.split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
}

function fixture(overrides: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'gmc-release-workflow-'));
  directories.push(directory);
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  pkg.version = '1.54.0';
  const original = `${JSON.stringify(pkg, null, 2)}\n`;
  writeFileSync(join(directory, 'package.json'), original);
  mkdirSync(join(directory, 'scripts'));
  for (const name of ['brew-sha.sh', 'update-homebrew-formula.js']) {
    copyFileSync(join(root, 'scripts', name), join(directory, 'scripts', name));
  }
  writeFileSync(join(directory, 'source-formula.rb'), `class GhManagerCli < Formula\n  homepage "https://github.com/wiiiimm/gh-manager-cli"\n  url "https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-1.53.1.tgz"\n  sha256 "${'0'.repeat(64)}"\nend\n`);

  writeFileSync(join(bin, 'npm'), `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync('npm-calls.jsonl', JSON.stringify(args) + '\\n');
if (args[0] === 'view') process.exit(process.env.MOCK_PACKAGE_EXISTS === '1' ? 0 : 1);
if (args[0] === 'pack') {
  fs.writeFileSync('archive.tgz', 'packed archive');
  console.log(JSON.stringify([{ filename: 'archive.tgz' }]));
} else if (args[0] === 'publish') {
  fs.copyFileSync('package.json', 'published-package.json');
  fs.writeFileSync('publish-auth-config-path', process.env.NPM_CONFIG_USERCONFIG);
  process.exit(process.env.MOCK_PUBLISH_FAILURE === '1' ? 7 : 0);
} else process.exit(99);
`, { mode: 0o755 });
  writeFileSync(join(bin, 'curl'), `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
if (args[0] !== '-fsSL' || !args[1].includes('/@stealth-factory/gh-manager-cli/-/gh-manager-cli-1.54.0.tgz')) process.exit(99);
fs.writeFileSync(args[3], 'published archive');
`, { mode: 0o755 });
  writeFileSync(join(bin, 'git'), `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
fs.appendFileSync(path.join(process.env.MOCK_ROOT, 'git-calls.jsonl'), JSON.stringify(args) + '\\n');
if (args[0] === 'clone') {
  fs.mkdirSync('tap-repo/Formula', { recursive: true });
  fs.copyFileSync('source-formula.rb', 'tap-repo/Formula/gh-manager-cli.rb');
} else if (args[0] === 'diff') process.exit(process.env.MOCK_NO_CHANGES === '1' ? 0 : 1);
else if (args[0] === 'push' && process.env.MOCK_PUSH_FAILURE === '1') process.exit(9);
`, { mode: 0o755 });
  const env = {
    ...process.env,
    PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`,
    MOCK_ROOT: directory,
    NODE_AUTH_TOKEN: 'offline-package-token',
    GITHUB_TOKEN: 'offline-tap-token',
    VERSION: '1.54.0',
    ...overrides,
  };
  return {
    directory,
    original,
    run: (name: string) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', runBlock(name)], { cwd: directory, env, encoding: 'utf8' }),
  };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('deployment workflow (GMC-54)', () => {
  it('checks out the same triggering commit for binaries, release metadata, and publication', () => {
    const refs = [...workflow.matchAll(/^          ref: (.+)$/gm)].map(match => match[1]);
    expect(refs).toEqual(['${{ github.sha }}', '${{ github.sha }}']);
  });

  it.each(['0', '1'])('publishes to the new GitHub scope and restores npmjs config even on failure=%s', failure => {
    const f = fixture({ MOCK_PUBLISH_FAILURE: failure });
    const result = f.run('Publish to GitHub Packages');
    expect(result.status).toBe(failure === '1' ? 7 : 0);
    const published = JSON.parse(readFileSync(join(f.directory, 'published-package.json'), 'utf8')) as {
      name: string; publishConfig: { registry: string }; repository: { url: string };
    };
    expect(published.name).toBe('@stealth-factory/gh-manager-cli');
    expect(published.publishConfig.registry).toBe('https://npm.pkg.github.com');
    expect(published.repository.url).toBe('https://github.com/stealth-factory/gh-manager-cli.git');
    expect(readFileSync(join(f.directory, 'package.json'), 'utf8')).toBe(f.original);
    const authConfig = readFileSync(join(f.directory, 'publish-auth-config-path'), 'utf8');
    expect(existsSync(authConfig)).toBe(false);
    const calls = readFileSync(join(f.directory, 'npm-calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]);
    expect(calls[0]).toEqual(['view', '@stealth-factory/gh-manager-cli@1.54.0', '--registry=https://npm.pkg.github.com']);
    expect(calls[2]).toEqual(['publish', 'archive.tgz', '--registry=https://npm.pkg.github.com']);
  });

  it('skips an already published GitHub version without changing the npmjs manifest', () => {
    const f = fixture({ MOCK_PACKAGE_EXISTS: '1' });
    expect(f.run('Publish to GitHub Packages').status).toBe(0);
    expect(readFileSync(join(f.directory, 'package.json'), 'utf8')).toBe(f.original);
    expect(readFileSync(join(f.directory, 'npm-calls.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('updates the transferred tap from the scoped archive and pushes the formula', () => {
    const f = fixture();
    expect(f.run('Update Homebrew Tap').status).toBe(0);
    const formula = readFileSync(join(f.directory, 'tap-repo/Formula/gh-manager-cli.rb'), 'utf8');
    expect(formula).toContain('/@stealth-factory/gh-manager-cli/-/gh-manager-cli-1.54.0.tgz');
    expect(formula).toContain(createHash('sha256').update('published archive').digest('hex'));
    const calls = readFileSync(join(f.directory, 'git-calls.jsonl'), 'utf8');
    expect(calls).toContain('@github.com/stealth-factory/homebrew-tap.git');
    expect(calls).toContain('["push","origin","main"]');
  });

  it('fails deployment when the transferred tap rejects the push', () => {
    const f = fixture({ MOCK_PUSH_FAILURE: '1' });
    expect(f.run('Update Homebrew Tap').status).toBe(9);
  });

  it('fails deployment when the required cross-repository token is missing', () => {
    const f = fixture({ GITHUB_TOKEN: '' });
    const result = f.run('Update Homebrew Tap');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error::Homebrew tap update requires GH_TOKEN');
  });

  it('allows a retry with no formula changes without committing or pushing', () => {
    const f = fixture({ MOCK_NO_CHANGES: '1' });
    expect(f.run('Update Homebrew Tap').status).toBe(0);
    const calls = readFileSync(join(f.directory, 'git-calls.jsonl'), 'utf8');
    expect(calls).not.toContain('["commit"');
    expect(calls).not.toContain('["push"');
  });
});
