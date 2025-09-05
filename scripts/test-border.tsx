import React from 'react';
import { render, Box, Text } from 'ink';

const TestBorder = () => {
  return (
    <Box flexDirection="column">
      <Text>Outside the border</Text>
      <Box borderStyle="single" borderColor="yellow" paddingX={1} paddingY={1}>
        <Text>Inside the border - this should have a yellow border</Text>
      </Box>
      <Text>After the border</Text>
    </Box>
  );
};

render(<TestBorder />);