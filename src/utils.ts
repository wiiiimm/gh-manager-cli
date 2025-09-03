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
 * Copies text to clipboard using multiple fallback strategies
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    // Try clipboardy first (cross-platform)
    const clipboardy = await import('clipboardy');
    await clipboardy.write(text);
    return;
  } catch (error) {
    // Fallback to OS-specific commands
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const platform = process.platform;
      
      if (platform === 'darwin') {
        // macOS - use pbcopy
        await execAsync(`echo "${text.replace(/"/g, '\\"')}" | pbcopy`);
      } else if (platform === 'win32') {
        // Windows - use clip
        await execAsync(`echo "${text.replace(/"/g, '\\"')}" | clip`);
      } else {
        // Linux - try xclip, xsel, or wl-copy
        try {
          await execAsync(`echo "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard`);
        } catch {
          try {
            await execAsync(`echo "${text.replace(/"/g, '\\"')}" | xsel --clipboard --input`);
          } catch {
            await execAsync(`echo "${text.replace(/"/g, '\\"')}" | wl-copy`);
          }
        }
      }
    } catch (osError) {
      throw new Error(`Failed to copy to clipboard. Please install a clipboard utility for your system.`);
    }
  }
}

