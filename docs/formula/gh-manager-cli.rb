require "language/node"

class GhManagerCli < Formula
  desc "Interactive CLI to manage GitHub repositories (Ink TUI)"
  homepage "https://github.com/wiiiimm/gh-manager-cli"
  url "https://registry.npmjs.org/gh-manager-cli/-/gh-manager-cli-1.11.0.tgz"
  sha256 "REPLACE_WITH_SHA256_FROM_NPM_TARBALL"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["
      #{libexec}/bin/*
    "]
  end

  test do
    output = shell_output("#{bin}/gh-manager-cli --version")
    assert_match(/\d+\.\d+\.\d+/, output)
  end
end

