import React from 'react';
import { render, Box, Text } from 'ink';

const TestEmpty = () => {
  const availableHeight = 20;
  const headerHeight = 2;
  const footerHeight = 4;
  const containerPadding = 2;
  const contentHeight = Math.max(1, availableHeight - headerHeight - footerHeight - containerPadding);

  return (
    <Box flexDirection="column" height={availableHeight}>
      {/* Header bar */}
      <Box flexDirection="row" justifyContent="space-between" height={1} marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text bold>  Repositories</Text>
          <Text color="gray">(0)</Text>
        </Box>
      </Box>

      {/* Main content container with border - THIS SHOULD SHOW A BORDER */}
      <Box borderStyle="single" borderColor="yellow" paddingX={1} paddingY={1} marginX={1} height={contentHeight + containerPadding + 2} flexDirection="column">
        <Box justifyContent="center" alignItems="center" flexGrow={1}>
          <Text color="gray">No repositories found</Text>
        </Box>
      </Box>

      {/* Help footer */}
      <Box marginTop={1} paddingX={1}>
        <Text color="gray">Press Q to quit</Text>
      </Box>
    </Box>
  );
};

render(<TestEmpty />);