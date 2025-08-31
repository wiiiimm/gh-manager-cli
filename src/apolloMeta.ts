import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';

type MetaFile = {
  version: number;
  fetched: Record<string, string>; // key -> ISO string
};

const paths = envPaths('gh-manager-cli');
const dataDir = paths.data;
const metaPath = path.join(dataDir, 'apollo-cache-meta.json');
const VERSION = 1;

function readMeta(): MetaFile {
  try {
    const raw = fs.readFileSync(metaPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.fetched) return parsed as MetaFile;
  } catch {}
  return { version: VERSION, fetched: {} };
}

function writeMeta(meta: MetaFile) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    if (process.platform !== 'win32') {
      try { fs.chmodSync(metaPath, 0o600); } catch {}
    }
  } catch {}
}

export function makeApolloKey(opts: {
  viewer: string;
  sortKey: string;
  sortDir: string;
  pageSize: number;
  forkTracking: boolean;
  ownerContext?: string;
  affiliations?: string;
}) {
  const v = opts.viewer || 'unknown';
  const context = opts.ownerContext || 'personal';
  const affiliations = opts.affiliations || 'OWNER';
  return `viewer:${v}|context:${context}|affiliations:${affiliations}|sort:${opts.sortKey}:${opts.sortDir}|ps:${opts.pageSize}|forks:${opts.forkTracking ? '1' : '0'}`;
}

export function isFresh(key: string, ttlMs = Number(process.env.APOLLO_TTL_MS || 30 * 60 * 1000)) {
  const meta = readMeta();
  const iso = meta.fetched[key];
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!isFinite(t)) return false;
  return (Date.now() - t) < ttlMs;
}

export function markFetched(key: string) {
  const meta = readMeta();
  meta.fetched[key] = new Date().toISOString();
  writeMeta(meta);
}
