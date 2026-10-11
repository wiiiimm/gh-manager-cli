import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLegacyPackage, prepare, publish } from '../scripts/release-legacy-package.js';

const { publishCommand } = vi.hoisted(() => ({ publishCommand: vi.fn() }));
vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  spawnSync: publishCommand,
}));

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scopedName = '@stealth-factory/gh-manager-cli';
interface PackageMetadata {
  name: string;
  version: string;
  type: string;
  bin: Record<string, string>;
  dependencies: Record<string, string>;
  engines: { node: string };
  publishConfig: { access: string; registry: string };
  repository: { url: string };
  release: { plugins: (string | unknown[])[] };
}
const canonical = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as PackageMetadata;
const temporaryDirectories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'gh-manager-migration-'));
  temporaryDirectories.push(directory);
  writeFileSync(join(directory, 'package.json'), JSON.stringify(canonical));
  copyFileSync(join(root, 'LICENSE'), join(directory, 'LICENSE'));
  return directory;
}
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('npm scope migration (GMC-54)', () => {
  it('publishes publicly under Stealth Factory and retains the executable name', () => {
    expect(canonical.name).toBe(scopedName);
    expect(canonical.bin).toEqual({ 'gh-manager-cli': 'dist/index.js' });
    expect(canonical.publishConfig).toEqual({ access: 'public', registry: 'https://registry.npmjs.org' });
    expect(canonical.repository.url).toBe('https://github.com/stealth-factory/gh-manager-cli.git');
    expect(canonical.release.plugins.indexOf('./scripts/release-legacy-package.js'))
      .toBe(canonical.release.plugins.indexOf('@semantic-release/npm') + 1);
  });

  it('prepares a same-version public launcher with an exact scoped dependency', () => {
    const directory = createLegacyPackage(fixture(), '1.54.0');
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as PackageMetadata;
    expect(pkg.name).toBe('gh-manager-cli');
    expect(pkg.version).toBe('1.54.0');
    expect(pkg.dependencies).toEqual({ [scopedName]: '1.54.0' });
    expect(pkg.bin).toEqual({ 'gh-manager-cli': 'index.js' });
    expect(pkg.engines).toEqual(canonical.engines);
    expect(pkg.publishConfig.access).toBe('public');
    expect(readFileSync(join(directory, 'LICENSE'), 'utf8')).toBe(readFileSync(join(root, 'LICENSE'), 'utf8'));
  });

  it('supports manual preparation from the version in the checkout', () => {
    const directory = createLegacyPackage(fixture());
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as PackageMetadata;
    expect(pkg.version).toBe(canonical.version);
    expect(pkg.dependencies[scopedName]).toBe(canonical.version);
  });

  it('launches the scoped package with the original arguments and exit status', () => {
    const directory = createLegacyPackage(fixture(), '1.54.0');
    const dependency = join(directory, 'node_modules', '@stealth-factory', 'gh-manager-cli');
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: scopedName, type: 'module', main: 'index.js' }));
    writeFileSync(join(dependency, 'index.js'), 'console.log(JSON.stringify(process.argv.slice(2))); process.exitCode = 7;');
    try {
      execFileSync(process.execPath, [join(directory, 'index.js'), '--org', 'acme', '--version']);
      throw new Error('Expected the scoped app exit status');
    } catch (error: unknown) {
      expect(error).toMatchObject({ status: 7 });
      const output = (error as { stdout: Buffer }).stdout.toString();
      expect(JSON.parse(output)).toEqual(['--org', 'acme', '--version']);
    }
  });

  it('rejects a checkout whose canonical package has the wrong identity', () => {
    const directory = fixture();
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ ...canonical, name: 'other-package' }));
    expect(() => createLegacyPackage(directory)).toThrow('Expected the canonical package');
  });

  it('prepares and publishes the compatibility artifact through the release hooks', () => {
    const cwd = fixture();
    const logger = { log: vi.fn() };
    const context = { cwd, nextRelease: { version: '1.54.0', channel: null }, logger };
    prepare({}, context);
    publishCommand.mockReturnValue({ status: 0 });
    const result = publish({}, context);
    expect(publishCommand).toHaveBeenCalledWith(expect.stringMatching(/^npm(?:\.cmd)?$/), [
      'publish', '--access', 'public', '--registry', 'https://registry.npmjs.org', '--tag', 'latest',
    ], { cwd: join(cwd, '.release', 'legacy'), stdio: 'inherit' });
    expect(result.url).toBe('https://www.npmjs.com/package/gh-manager-cli/v/1.54.0');
  });

  it('fails the release when compatibility publication fails', () => {
    publishCommand.mockReturnValue({ status: 1 });
    expect(() => publish({}, {
      cwd: fixture(), nextRelease: { version: '1.54.0', channel: null }, logger: { log: vi.fn() },
    })).toThrow('Failed to publish');
  });
});
