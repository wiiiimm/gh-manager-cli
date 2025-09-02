import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

export type AuthMethod = 'pat' | 'oauth';

interface AuthMethodSelectorProps {
  onSelect: (method: AuthMethod) => void;
  onQuit?: () => void;
}

export default function AuthMethodSelector({ onSelect, onQuit }: AuthMethodSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const methods: { key: AuthMethod; label: string; description: string }[] = [
    {
      key: 'oauth',
      label: 'GitHub OAuth',
      description: 'Login via GitHub in your browser (recommended)'
    },
    {
      key: 'pat',
      label: 'Personal Access Token',
      description: 'Manually enter a GitHub Personal Access Token'
    }
  ];

  useInput((input, key) => {
    if (key.escape || input?.toLowerCase() === 'q') {
      if (onQuit) {
        onQuit();
      } else {
        process.exit(0);
      }
    } else if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(methods.length - 1, prev + 1));
    } else if (key.return) {
      onSelect(methods[selectedIndex].key);
    } else if (input === '1') {
      onSelect('oauth');
    } else if (input === '2') {
      onSelect('pat');
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold marginBottom={1}>
        Choose Authentication Method
      </Text>
      
      <Box flexDirection="column" marginY={1}>
        {methods.map((method, index) => {
          const isSelected = index === selectedIndex;
          const prefix = isSelected ? chalk.cyan('›') : ' ';
          const numberPrefix = `${index + 1}.`;
          
          return (
            <Box key={method.key} flexDirection="column" marginBottom={1}>
              <Text>
                <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                  {prefix} {numberPrefix} {method.label}
                </Text>
              </Text>
              <Text color="gray" dimColor>
                {'   '}{method.description}
              </Text>
            </Box>
          );
        })}
      </Box>
      
      <Text color="gray" dimColor marginTop={1}>
        Use arrow keys to navigate, Enter to select, or press 1/2 • Q/Esc to quit
      </Text>
    </Box>
  );
}

