import React from 'react';
import { render, Box, Text } from 'ink';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import is handled by tsup/esbuild
import pkg from '../package.json';
import 'dotenv/config';
import App from './ui/App';
import { logger } from './lib/logger';
import { formatSessionSummary, formatSupportMessage } from './lib/session';

// Basic CLI flags (handled before rendering Ink)
const argv = process.argv.slice(2);

// Simple argv helpers
const getFlagValue = (name: string): string | undefined => {
  // Supports --name value and --name=value
  const idx = argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return undefined;
  const at = argv[idx];
  if (at.includes('=')) {
    const [, v] = at.split('=');
    return v?.trim() || undefined;
  }
  const next = argv[idx + 1];
  if (next && !next.startsWith('-')) return next.trim();
  return undefined;
};
const getShortFlagValue = (short: string): string | undefined => {
  // Supports -x value and -x=value
  const exact = `-${short}`;
  const idx = argv.findIndex(a => a === exact || a.startsWith(`${exact}=`));
  if (idx === -1) return undefined;
  const at = argv[idx];
  if (at.includes('=')) {
    const [, v] = at.split('=');
    return v?.trim() || undefined;
  }
  const next = argv[idx + 1];
  if (next && !next.startsWith('-')) return next.trim();
  return undefined;
};
if (argv.includes('--version') || argv.includes('-v')) {
  // Print semantic version without network
  const version = (pkg as { version?: string })?.version || '0.0.0';
  process.stdout.write(`${version}\n`);
  process.exit(0);
}
if (argv.includes('--help') || argv.includes('-h')) {
  const version = (pkg as { version?: string })?.version || '0.0.0';
  process.stdout.write(`gh-manager-cli v${version}\n\n` +
    `GitHub repo manager (Ink TUI)\n\n` +
    `Usage:\n` +
    `  gh-manager-cli                     Launch the TUI\n` +
    `  gh-manager-cli --org, -o <slug>    Start in an organisation context (if accessible)\n` +
    `  gh-manager-cli --token, -t <pat>   Use a token just for this run (not persisted)\n` +
    `  gh-manager-cli --version           Print version\n` +
    `  gh-manager-cli --help              Show help\n\n` +
    `Env:\n` +
    `  GITHUB_TOKEN / GH_TOKEN   Personal Access Token\n` +
    `  REPOS_PER_FETCH           Page size (1-50)\n`);
  process.exit(0);
}

// Debug: Check if environment variables are loaded
if (process.env.GH_MANAGER_DEBUG === '1') {
  process.stderr.write('🐛 Debug mode enabled\n');
  logger.debug('Debug mode enabled via GH_MANAGER_DEBUG');
}

logger.info('Starting gh-manager-cli', { 
  version: (pkg as { version?: string })?.version || '0.0.0',
  node: process.version
});

// Graceful shutdown handlers
// Signal-driven exits (Ctrl+C / kill) still exit with code 0, so flag them here
// to suppress the end-of-session summary, which is meant only for a normal quit.
let exitingViaSignal = false;
const handleShutdown = (signal: string) => {
  exitingViaSignal = true;
  logger.info('Shutting down gh-manager-cli', {
    signal,
    uptime: process.uptime()
  });
  process.exit(0);
};

// Function to show the session usage summary followed by the (visually
// separate) sponsorship message. Each is its own framed panel, so the summary
// no longer piles onto the thank-you / sponsor block.
const showSponsorshipMessage = () => {
  process.stdout.write(formatSessionSummary());
  process.stdout.write(formatSupportMessage());
  process.stdout.write('\n');
};

// Register shutdown handlers
process.on('SIGINT', () => handleShutdown('SIGINT'));  // Ctrl+C
process.on('SIGTERM', () => handleShutdown('SIGTERM')); // Kill signal
process.on('exit', (code) => {
  // Only show sponsorship message on normal exit (code 0)
  // and not when there's an error or when using --version/--help
  const isNormalExit = code === 0;
  const isInteractiveSession = !argv.includes('--version') &&
                               !argv.includes('-v') &&
                               !argv.includes('--help') &&
                               !argv.includes('-h');

  if (isNormalExit && isInteractiveSession && !exitingViaSignal) {
    showSponsorshipMessage();
  }
  
  logger.info('gh-manager-cli exited', { 
    exitCode: code,
    uptime: process.uptime()
  });
});

process.on('uncaughtException', (err) => {
  // Make sure the user sees a clean error and non-zero exit
  logger.fatal('Uncaught exception', { error: err.message, stack: err.stack });
  console.error('Unhandled error:', err.message || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason: unknown) => {
  const reasonErr = reason instanceof Error ? reason : null;
  logger.fatal('Unhandled rejection', { error: reasonErr?.message || String(reason), stack: reasonErr?.stack });
  console.error('Unhandled rejection:', reasonErr?.message || reason);
  process.exit(1);
});

// Parse optional flags
const initialOrgSlug = (() => {
  const v = getFlagValue('org') ?? getShortFlagValue('o');
  if (!v) return undefined;
  // Normalise: strip leading @ if provided
  return v.replace(/^@/, '');
})();

const inlineToken = (() => {
  const v = getFlagValue('token') ?? getShortFlagValue('t');
  if (!v) return undefined;
  return v.trim();
})();

logger.debug('Rendering UI');
const { unmount } = render(
  <Box flexDirection="column">
    <App initialOrgSlug={initialOrgSlug} inlineToken={inlineToken} inlineTokenEphemeral={Boolean(inlineToken)} />
    <Text color="gray"></Text>
  </Box>
);
