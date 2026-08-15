import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

interface PackageJson {
  scripts?: Record<string, string>;
  engines?: { node?: string };
  devDependencies?: Record<string, string>;
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('standalone binary packaging (GMC-52)', () => {
  const pkg = JSON.parse(readRepoFile('package.json')) as PackageJson;
  const buildBinaries = pkg.scripts?.['build:binaries'] ?? '';
  const releaseWorkflow = readRepoFile('.github/workflows/release.yml');
  const expectedTargets = [
    'node22-linux-x64',
    'node22-macos-x64',
    'node22-windows-x64',
  ];

  it('pins @yao-pkg/pkg instead of a floating global pkg', () => {
    expect(pkg.devDependencies?.['@yao-pkg/pkg']).toMatch(/^\^?6\./);
    expect(buildBinaries).toContain('pnpm exec pkg');
    expect(buildBinaries).not.toMatch(/npm install -g/);
    expect(releaseWorkflow).toContain('pnpm exec pkg');
    expect(releaseWorkflow).not.toMatch(/npm install -g @yao-pkg\/pkg/);
  });

  it('targets node22 bases that pkg-fetch still publishes', () => {
    expect(buildBinaries).toContain(expectedTargets.join(','));
    expect(buildBinaries).not.toMatch(/node20-/);
    expect(releaseWorkflow).toMatch(/--targets node22-\$\{\{ matrix\.platform \}\}-\$\{\{ matrix\.arch \}\}/);
    expect(releaseWorkflow).not.toMatch(/--targets node20-/);
  });

  it('requires Node 22.12+ for the CLI and binaries', () => {
    expect(pkg.engines?.node).toBe('>=22.12.0');
    expect(releaseWorkflow).toMatch(/node-version:\s*'22'/);
  });
});
