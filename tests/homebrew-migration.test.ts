import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { updateHomebrewFormula } from '../scripts/update-homebrew-formula.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectories: string[] = [];
const checksum = 'a'.repeat(64);
function fixture(prefix = '') {
  const directory = mkdtempSync(join(tmpdir(), 'gh-manager-brew-'));
  temporaryDirectories.push(directory);
  const formula = join(directory, 'gh-manager-cli.rb');
  writeFileSync(formula, `class GhManagerCli < Formula\n  homepage "https://github.com/wiiiimm/gh-manager-cli"\n  url "https://registry.npmjs.org/${prefix}gh-manager-cli/-/gh-manager-cli-1.53.1.tgz"\n  sha256 "${'0'.repeat(64)}"\nend\n`);
  return { directory, formula };
}
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Homebrew scope migration (GMC-54)', () => {
  it.each(['', '@stealth-factory/'])('updates an existing %s npm source and its checksum', prefix => {
    const { formula } = fixture(prefix);
    updateHomebrewFormula(formula, '1.54.0', checksum);
    const output = readFileSync(formula, 'utf8');
    expect(output).toContain('https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-1.54.0.tgz');
    expect(output).toContain(`sha256 "${checksum}"`);
    expect(output).toContain('homepage "https://github.com/stealth-factory/gh-manager-cli"');
    expect(output).not.toContain('1.53.1');
  });

  it('updates an explicit version override in the formula', () => {
    const { formula } = fixture();
    writeFileSync(formula, readFileSync(formula, 'utf8').replace('  sha256', '  version "1.53.1"\n  sha256'));
    updateHomebrewFormula(formula, '1.54.0', checksum);
    expect(readFileSync(formula, 'utf8')).toContain('version "1.54.0"');
  });

  it('leaves the file intact when the checksum or source is invalid', () => {
    const { formula } = fixture();
    const original = readFileSync(formula, 'utf8');
    expect(() => updateHomebrewFormula(formula, '1.54.0', 'invalid')).toThrow('SHA256');
    expect(() => updateHomebrewFormula(formula, '../invalid', checksum)).toThrow('stable release');
    expect(readFileSync(formula, 'utf8')).toBe(original);
    const unexpectedSource = original.replace('registry.npmjs.org', 'example.com');
    writeFileSync(formula, unexpectedSource);
    expect(() => updateHomebrewFormula(formula, '1.54.0', checksum)).toThrow('Could not find');
    expect(readFileSync(formula, 'utf8')).toBe(unexpectedSource);
  });

  it('hashes the downloaded unscoped archive and fails on HTTP errors', () => {
    const { directory } = fixture();
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    // Offline curl stub: checks the requested URL/HTTP-failure flag, then writes
    // bytes to the download path. A missing archive simulates curl's HTTP exit.
    writeFileSync(join(bin, 'curl'), '#!/bin/bash\n[[ "$1" == "-fsSL" ]] || exit 99\n[[ "$2" == "https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-1.54.0.tgz" ]] || exit 98\nif [[ "${MOCK_HTTP_ERROR:-}" == "1" ]]; then exit 22; fi\nprintf "published archive" > "$4"\n', { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: directory };
    const args = [join(root, 'scripts/brew-sha.sh'), '1.54.0'];
    const success = spawnSync('bash', args, { env, encoding: 'utf8' });
    expect(success.status).toBe(0);
    expect(success.stdout).toContain(createHash('sha256').update('published archive').digest('hex'));
    const failure = spawnSync('bash', args, { env: { ...env, MOCK_HTTP_ERROR: '1' }, encoding: 'utf8' });
    expect(failure.status).not.toBe(0);
    expect(failure.stdout).not.toContain('sha256:');
    expect(failure.stderr).toContain('Failed to download tarball');
  });
});
