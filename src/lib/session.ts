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
  // Clamp to zero so a backward clock adjustment during the session can never
  // produce a negative or non-finite duration in the summary.
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
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

// Rough estimate of how long each operation takes to perform by hand in the
// GitHub web UI (in seconds): navigating to the repo, opening Settings, the
// Danger Zone confirmation dialogs, typing the repo name, etc. These are
// deliberately conservative, round figures — the summary presents the result
// as an approximation ("~"), not a precise measurement.
const MANUAL_TIME_SECONDS: Record<OperationType, number> = {
  delete: 45, // Settings → Danger Zone → type repo name → confirm
  archive: 40, // Settings → Danger Zone → archive → confirm
  unarchive: 40,
  visibilityChange: 40, // Settings → Danger Zone → change visibility → confirm
  syncFork: 20, // Open fork → "Sync fork" → update branch
  rename: 30, // Settings → rename → confirm
  star: 6, // Open repo → click star
  unstar: 6,
  transfer: 60, // Settings → Danger Zone → transfer → type name + new owner
};

// Estimate the time saved this session by doing the tracked operations in the
// CLI instead of by hand on github.com. The per-keystroke cost in the CLI is
// negligible next to the web UI's navigation + confirmation flows, so we treat
// the manual time as the saving. Returns milliseconds.
export function estimateTimeSavedMs(): number {
  let seconds = 0;
  for (const [type, n] of Object.entries(counts) as [OperationType, number][]) {
    seconds += n * MANUAL_TIME_SECONDS[type];
  }
  return seconds * 1000;
}

// Map a bulk (multi-select) action to its session OperationType. Kept here so
// both the single-repo handlers and the bulk loop record the same per-type
// counts in the end-of-session summary. 'visibility' is the only name that
// differs from its OperationType ('visibilityChange'); the rest are identical.
export function bulkActionToOperation(
  action: 'delete' | 'archive' | 'unarchive' | 'star' | 'unstar' | 'visibility' | 'transfer',
): OperationType {
  return action === 'visibility' ? 'visibilityChange' : action;
}

// Inner width of the framed panels (characters between the left/right rules).
const PANEL_WIDTH = 58;

// A boxed title bar like:
//   ╭──────────────────────────────────────────────────────────╮
//   │  📊  Session Summary
//   ╰──────────────────────────────────────────────────────────╯
// The right edge is intentionally left open on the title row so emoji width
// quirks across terminals never misalign a closing border.
function panelHeader(title: string): string[] {
  const rule = '─'.repeat(PANEL_WIDTH);
  return [
    `  ╭${rule}╮`,
    `  │  ${title}`,
    `  ╰${rule}╯`,
  ];
}

export function formatSessionSummary(): string {
  const durationMs = Date.now() - startTime.getTime();
  const durationStr = formatDuration(durationMs);
  const total = getTotalOperations();

  const lines: string[] = ['', ...panelHeader('📊  Session Summary'), ''];

  if (total === 0) {
    lines.push(`     Duration:    ${durationStr}`);
    lines.push('     No changes were made this session.');
  } else {
    lines.push(`     Duration:    ${durationStr}`);
    lines.push(`     Operations:  ${total} performed`);
    lines.push('');
    for (const [type, n] of Object.entries(counts) as [OperationType, number][]) {
      if (n > 0) {
        const noun = n === 1 ? 'repository' : 'repositories';
        lines.push(`       • ${n} ${noun} ${OPERATION_LABELS[type]}`);
      }
    }

    const savedMs = estimateTimeSavedMs();
    if (savedMs > 0) {
      lines.push('');
      lines.push(`     ⏱  Estimated time saved:  ~${formatDuration(savedMs)}`);
      lines.push('        (vs performing these by hand on github.com)');
    }
  }

  lines.push('');
  return lines.join('\n');
}

// The thank-you / sponsorship message, rendered as its own framed panel so it
// reads as a section distinct from the usage summary above it.
export function formatSupportMessage(): string {
  const lines: string[] = [
    '',
    ...panelHeader('💚  Thank you for using gh-manager-cli!'),
    '',
    '     If this app saved you time, please consider supporting',
    '     the development of more open-source projects like this:',
    '',
    '       💖 Sponsor on GitHub:  https://github.com/sponsors/wiiiimm',
    '       🚀 Visit my site:      https://wiiiimm.codes',
    '       💬 Leave feedback:     https://github.com/wiiiimm/gh-manager-cli',
    '',
    '     Your support keeps this project alive! 🙏',
    '',
  ];
  return lines.join('\n');
}
