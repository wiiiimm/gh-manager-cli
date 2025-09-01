#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { get } from 'node:https';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import pkg from '../package.json' assert { type: 'json' };

const streamPipeline = promisify(pipeline);

async function sha256OfUrl(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const hash = createHash('sha256');
      res.on('data', (chunk) => hash.update(chunk));
      res.on('end', () => resolve(hash.digest('hex')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const version = pkg.version;
  const url = `https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-${version}.tgz`;
  const sha256 = await sha256OfUrl(url);

  const formula = `require "language/node"\n\nclass GhManagerCli < Formula\n  desc "Interactive CLI to manage GitHub repositories (Ink TUI)"\n  homepage "https://github.com/wiiiimm/gh-manager-cli"\n  url "${url}"\n  sha256 "${sha256}"\n  license "MIT"\n\n  depends_on "node"\n\n  def install\n    system "npm", "install", *Language::Node.std_npm_install_args(libexec)\n    bin.install_symlink Dir["\n      \\#{libexec}/bin/*\n    "]\n  end\n\n  test do\n    output = shell_output("\\#{bin}/gh-manager-cli --version")\n    assert_match(/\\d+\\.\\d+\\.\\d+/, output)\n  end\nend\n`;

  process.stdout.write(formula);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

