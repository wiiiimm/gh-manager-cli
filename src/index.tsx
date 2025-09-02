import React from 'react';
import { render, Box, Text } from 'ink';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import is handled by tsup/esbuild
import pkg from '../package.json';
import 'dotenv/config';
import App from './ui/App';
import { logger } from './logger';

// Basic CLI flags (handled before rendering Ink)
const argv = process.argv.slice(2);
if (argv.includes('--version') || argv.includes('-v')) {
  // Print semantic version without network
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const version = (pkg as any)?.version || '0.0.0';
  process.stdout.write(`${version}\n`);
  process.exit(0);
}
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(`\n` +
    `gh-manager-cli — GitHub repo manager (Ink TUI)\n\n` +
    `Usage:\n` +
    `  gh-manager-cli            Launch the TUI\n` +
    `  gh-manager-cli --version  Print version\n` +
    `  gh-manager-cli --help     Show help\n\n` +
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
  version: (pkg as any)?.version || '0.0.0',
  node: process.version
});

// Graceful shutdown handlers
const handleShutdown = (signal: string) => {
  logger.info('Shutting down gh-manager-cli', { 
    signal,
    uptime: process.uptime()
  });
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGINT', () => handleShutdown('SIGINT'));  // Ctrl+C
process.on('SIGTERM', () => handleShutdown('SIGTERM')); // Kill signal
process.on('exit', (code) => {
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
process.on('unhandledRejection', (reason: any) => {
  logger.fatal('Unhandled rejection', { error: reason?.message || reason, stack: reason?.stack });
  console.error('Unhandled rejection:', reason?.message || reason);
  process.exit(1);
});

logger.debug('Rendering UI');
const { unmount } = render(
  <Box flexDirection="column">
    <App />
    <Text color="gray"></Text>
  </Box>
);
