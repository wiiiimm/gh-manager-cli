import React from 'react';
import { render, Box, Text } from 'ink';
import 'dotenv/config';
import App from './ui/App';

process.on('uncaughtException', (err) => {
  // Make sure the user sees a clean error and non-zero exit
  console.error('Unhandled error:', err.message || err);
  process.exit(1);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection:', reason?.message || reason);
  process.exit(1);
});

render(
  <Box flexDirection="column">
    <App />
    <Text color="gray"></Text>
  </Box>
);
