export type OperationType =
  | 'delete'
  | 'archive'
  | 'unarchive'
  | 'visibilityChange'
  | 'syncFork'
  | 'rename'
  | 'star'
  | 'unstar'
  | 'transfer';

interface OperationCounts {
  delete: number;
  archive: number;
  unarchive: number;
  visibilityChange: number;
  syncFork: number;
  rename: number;
  star: number;
  unstar: number;
  transfer: number;
}

const startTime = new Date();
const counts: OperationCounts = {
  delete: 0,
  archive: 0,
  unarchive: 0,
  visibilityChange: 0,
  syncFork: 0,
  rename: 0,
  star: 0,
  unstar: 0,
  transfer: 0,
};

export function trackOperation(type: OperationType): void {
  counts[type]++;
}

export function getTotalOperations(): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

const OPERATION_LABELS: Record<OperationType, string> = {
  delete: 'deleted',
  archive: 'archived',
  unarchive: 'unarchived',
  visibilityChange: 'visibility changed',
  syncFork: 'fork synced',
  rename: 'renamed',
  star: 'starred',
  unstar: 'unstarred',
  transfer: 'transferred',
};

// Map a bulk (multi-select) action to its session OperationType. Kept here so
// both the single-repo handlers and the bulk loop record the same per-type
// counts in the end-of-session summary. 'visibility' is the only name that
// differs from its OperationType ('visibilityChange'); the rest are identical.
export function bulkActionToOperation(
  action: 'delete' | 'archive' | 'unarchive' | 'star' | 'unstar' | 'visibility' | 'transfer',
): OperationType {
  return action === 'visibility' ? 'visibilityChange' : action;
}

export function formatSessionSummary(): string {
  const durationMs = Date.now() - startTime.getTime();
  const durationStr = formatDuration(durationMs);
  const total = getTotalOperations();

  const hr = '─'.repeat(60);
  const lines: string[] = ['\n' + hr, ''];

  if (total === 0) {
    lines.push(`  Session: ${durationStr}  •  No changes made`);
  } else {
    lines.push(`  Session: ${durationStr}  •  ${total} operation${total === 1 ? '' : 's'} performed`);
    lines.push('');
    for (const [type, n] of Object.entries(counts) as [OperationType, number][]) {
      if (n > 0) {
        const noun = n === 1 ? 'repository' : 'repositories';
        lines.push(`    • ${n} ${noun} ${OPERATION_LABELS[type]}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}
