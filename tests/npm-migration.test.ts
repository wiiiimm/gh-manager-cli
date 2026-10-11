import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonical = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string; bin: Record<string, string>; main: string; files: string[];
  dependencies: Record<string, string>; publishConfig: { access: string; registry: string };
  repository: { url: string }; release: { plugins: (string | unknown[])[] };
};

describe('unscoped npm publication (GMC-56)', () => {
  it('publishes the application directly under the short command name', () => {
    expect(canonical.name).toBe('gh-manager-cli');
    expect(canonical.bin).toEqual({ 'gh-manager-cli': 'dist/index.js' });
    expect(canonical.main).toBe('dist/index.js');
    expect(canonical.files).toContain('dist/');
    expect(canonical.dependencies).not.toHaveProperty('@stealth-factory/gh-manager-cli');
    expect(canonical.repository.url).toBe('https://github.com/stealth-factory/gh-manager-cli.git');
    expect(canonical.publishConfig.access).toBe('public');
  });

  it('uses the exact official registry URL recognised by the installed npm plugin for OIDC', async () => {
    const require = createRequire(import.meta.url);
    const pluginRequire = createRequire(require.resolve('semantic-release'));
    const pluginRoot = dirname(pluginRequire.resolve('@semantic-release/npm'));
    const { OFFICIAL_REGISTRY } = await import(pathToFileURL(join(pluginRoot, 'lib/definitions/constants.js')).href) as { OFFICIAL_REGISTRY: string };
    expect(canonical.publishConfig.registry).toBe(OFFICIAL_REGISTRY);
  });

  it('publishes only the main package rather than invoking the retired scoped launcher flow', () => {
    expect(canonical.release.plugins).toContain('@semantic-release/npm');
    expect(canonical.release.plugins).not.toContain('./scripts/release-legacy-package.js');
  });
});
