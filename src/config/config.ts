import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';

type Density = 0 | 1 | 2;

export type OwnerContext = 'personal' | { type: 'organization', login: string, name?: string };

interface UIPrefs {
  sortKey?: 'updated' | 'pushed' | 'name' | 'stars';
  sortDir?: 'asc' | 'desc';
  density?: Density;
  forkTracking?: boolean;
  ownerAffiliations?: string[];
  ownerContext?: OwnerContext;
  visibilityFilter?: 'all' | 'public' | 'private';
}

export type TokenSource = 'pat' | 'oauth';

interface ConfigShape {
  token?: string;
  tokenVersion?: number;
  tokenSource?: TokenSource;
  ui?: UIPrefs;
}

const paths = envPaths('gh-manager-cli');
const configDir = paths.config;
const configFile = path.join(configDir, 'config.json');

export function getConfigPath() {
  return configFile;
}

export function readConfig(): ConfigShape {
  try {
    const data = fs.readFileSync(configFile, 'utf8');
    const json = JSON.parse(data);
    return json as ConfigShape;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: ConfigShape) {
  fs.mkdirSync(configDir, { recursive: true });
  const body = JSON.stringify(cfg, null, 2);
  fs.writeFileSync(configFile, body, 'utf8');
  // Tighten permissions on POSIX
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(configFile, 0o600);
    } catch {
      // ignore
    }
  }
}

export function getTokenFromEnv(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

export function getStoredToken(): string | undefined {
  const cfg = readConfig();
  return cfg.token;
}

export function storeToken(token: string, source: TokenSource = 'pat') {
  const existing = readConfig();
  writeConfig({ ...existing, token, tokenVersion: 1, tokenSource: source });
}

export function clearStoredToken() {
  const existing = readConfig();
  // Preserve other settings like ui prefs
  const { token, tokenVersion, tokenSource, ...rest } = existing as any;
  writeConfig({ ...rest });
}

export function getTokenSource(): TokenSource {
  const cfg = readConfig();
  return cfg.tokenSource || 'pat'; // Default to PAT for backward compatibility
}

export function getUIPrefs(): UIPrefs {
  const cfg = readConfig();
  return cfg.ui || {};
}

export function storeUIPrefs(patch: Partial<UIPrefs>) {
  const existing = readConfig();
  const mergedUI = { ...(existing.ui || {}), ...patch };
  writeConfig({ ...existing, ui: mergedUI });
}
