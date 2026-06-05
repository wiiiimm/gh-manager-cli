/**
 * Truncates a string to a maximum length, adding an ellipsis if needed
 */
export function truncate(str: string, max = 80) {
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 1)) + '…';
}

/**
 * Formats a date string into a human-readable relative time
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Compute the virtualization window for the repository list.
 *
 * In compact mode (spacingLines === 0) repo rows have variable heights:
 *   - 3 terminal lines when the repo has a description
 *   - 2 terminal lines when it does not
 *
 * In cozy/comfy modes (spacingLines > 0) every row has a fixed height of
 * 3 content lines + spacingLines padding lines.
 *
 * Returns the half-open interval [start, end) of items to render, with a
 * small read-ahead buffer on each side to reduce re-renders while scrolling.
 */
export function computeWindow(
  items: { description?: string | null }[],
  cursor: number,
  listHeight: number,
  spacingLines: number,
  buffer = 2,
): { start: number; end: number } {
  const total = items.length;

  if (spacingLines > 0) {
    // Fixed row height for cozy / comfy densities
    const LINES_PER_REPO = 3 + spacingLines;
    const visibleRepos = Math.max(1, Math.floor(listHeight / LINES_PER_REPO));

    if (visibleRepos >= total) return { start: 0, end: total };

    const half = Math.floor(visibleRepos / 2);
    let start = Math.max(0, cursor - half - buffer);
    start = Math.min(start, Math.max(0, total - visibleRepos));
    const end = Math.min(total, start + visibleRepos + buffer);
    return { start, end };
  }

  // Compact mode: variable row heights based on description presence
  const rowHeight = (idx: number) => (items[idx].description ? 3 : 2);

  // Fast paths to avoid a full scan when the answer is obvious
  if (total * 3 <= listHeight) return { start: 0, end: total }; // all fit at max height

  if (total * 2 <= listHeight) {
    // May or may not fit — count actual lines
    let totalLines = 0;
    for (let i = 0; i < total; i++) totalLines += rowHeight(i);
    if (totalLines <= listHeight) return { start: 0, end: total };
  }

  // Center the window on the cursor using actual per-row heights
  const halfHeight = Math.floor(listHeight / 2);

  // Walk backward from cursor to find the window start
  let start = cursor;
  let accBack = 0;
  while (start > 0) {
    const h = rowHeight(start - 1);
    if (accBack + h > halfHeight) break;
    accBack += h;
    start--;
  }

  // Walk forward from start to find the window end
  let end = start;
  let accFwd = 0;
  while (end < total) {
    const h = rowHeight(end);
    if (accFwd + h > listHeight) break;
    accFwd += h;
    end++;
  }

  // When the cursor is near the bottom, extend start backward to pack the view
  if (end >= total) {
    let accFill = accFwd;
    while (start > 0) {
      const h = rowHeight(start - 1);
      if (accFill + h > listHeight) break;
      accFill += h;
      start--;
    }
  }

  return { start: Math.max(0, start - buffer), end: Math.min(total, end + buffer) };
}

/**
 * Copies text to clipboard using multiple fallback strategies
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    // Try clipboardy first (cross-platform)
    const clipboardy = await import('clipboardy');
    await clipboardy.write(text);
    return;
  } catch (error) {
    // Fallback to OS-specific commands using spawn for security
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');

    const spawnCommand = (command: string, args: string[] = []): Promise<void> => {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
        
        child.stdin.write(text);
        child.stdin.end();
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Command failed with code ${code}`));
          }
        });
        
        child.on('error', reject);
      });
    };

    try {
      const platform = process.platform;
      
      if (platform === 'darwin') {
        // macOS - use pbcopy
        await spawnCommand('pbcopy');
      } else if (platform === 'win32') {
        // Windows - use clip
        await spawnCommand('clip');
      } else {
        // Linux - try xclip, xsel, or wl-copy
        try {
          await spawnCommand('xclip', ['-selection', 'clipboard']);
        } catch {
          try {
            await spawnCommand('xsel', ['--clipboard', '--input']);
          } catch {
            await spawnCommand('wl-copy');
          }
        }
      }
    } catch (osError) {
      throw new Error(`Failed to copy to clipboard. Please install a clipboard utility for your system.`);
    }
  }
}

