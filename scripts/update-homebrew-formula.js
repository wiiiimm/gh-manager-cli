import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function updateHomebrewFormula(file, version, sha256) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable release version (X.Y.Z)');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Expected a SHA256 checksum');
  const original = readFileSync(file, 'utf8');
  const urlPattern = /^\s*url "https:\/\/registry\.npmjs\.org\/(?:@stealth-factory\/)?gh-manager-cli\/-\/gh-manager-cli-[^"\n]+\.tgz"$/m;
  const shaPattern = /^\s*sha256 "[a-f0-9]{64}"$/m;
  if (!urlPattern.test(original) || !shaPattern.test(original)) {
    throw new Error('Could not find the gh-manager-cli npm tarball URL and checksum in the formula');
  }
  const updated = original
    .replace(urlPattern, `  url "https://registry.npmjs.org/@stealth-factory/gh-manager-cli/-/gh-manager-cli-${version}.tgz"`)
    .replace(shaPattern, `  sha256 "${sha256}"`)
    .replace(/^\s*version "[^"\n]+"$/m, `  version "${version}"`)
    .replace('https://github.com/wiiiimm/gh-manager-cli', 'https://github.com/stealth-factory/gh-manager-cli');
  writeFileSync(file, updated);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, version, sha256] = process.argv.slice(2);
  if (!file || !version || !sha256) throw new Error('Usage: node scripts/update-homebrew-formula.js <formula> <version> <sha256>');
  updateHomebrewFormula(file, version, sha256);
}
