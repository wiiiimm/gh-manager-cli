import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface FilterInputProps {
  filter: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  searchActive: boolean;
  searchLoading: boolean;
  addDebugMessage?: (msg: string) => void;
}

export default function FilterInput({ 
  filter, 
  onChange, 
  onSubmit, 
  searchActive, 
  searchLoading,
  addDebugMessage = () => {} 
}: FilterInputProps) {
  return (
    <Box marginBottom={1}>
      <Text>Filter: </Text>
      <TextInput
        value={filter}
        onChange={(val) => {
          addDebugMessage(`[onChange] val="${val}"`);
          onChange(val);
        }}
        onSubmit={onSubmit}
        placeholder="Type to search (3+ chars for server search)..."
      />
    </Box>
  );
}

