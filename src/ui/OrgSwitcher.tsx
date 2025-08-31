import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { fetchViewerOrganizations } from '../github';
import type { OrganizationNode } from '../types';
import { OwnerContext } from '../config';

interface OrgSwitcherProps {
  token: string;
  currentContext: OwnerContext;
  onSelect: (context: OwnerContext) => void;
  onClose: () => void;
}

export default function OrgSwitcher({ token, currentContext, onSelect, onClose }: OrgSwitcherProps) {
  const [organizations, setOrganizations] = useState<OrganizationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  
  // Determine if the current context is personal or an organization
  const isPersonalContext = currentContext === 'personal';
  
  // Load organizations on mount
  useEffect(() => {
    const loadOrgs = async () => {
      try {
        setLoading(true);
        const client = await import('../github').then(m => m.makeClient(token));
        const orgs = await fetchViewerOrganizations(client);
        setOrganizations(orgs);
        
        // Set initial cursor position based on current context
        if (!isPersonalContext) {
          const orgLogin = (currentContext as any).login;
          const index = orgs.findIndex(org => org.login === orgLogin);
          if (index !== -1) {
            setCursor(index + 1); // +1 because personal account is at index 0
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };
    
    loadOrgs();
  }, [token, currentContext, isPersonalContext]);
  
  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    
    if (key.return) {
      if (cursor === 0) {
        // Personal account selected
        onSelect('personal');
      } else if (cursor <= organizations.length) {
        // Organization selected
        const org = organizations[cursor - 1];
        onSelect({
          type: 'organization',
          login: org.login,
          name: org.name || undefined
        });
      }
      return;
    }
    
    if (key.upArrow) {
      setCursor(c => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor(c => Math.min(organizations.length, c + 1));
    }
  });
  
  // Calculate total items (personal account + organizations)
  const totalItems = organizations.length + 1;
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={3} paddingY={2} width={60}>
      <Text bold>Switch Account/Organization</Text>
      
      {loading ? (
        <Text color="yellow">Loading organizations...</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {/* Personal account option */}
          <Box>
            <Text>
              {cursor === 0 
                ? chalk.bgCyan.black(' → ') + ' ' + chalk.bold('Personal Account') 
                : '   ' + chalk.gray('Personal Account')}
            </Text>
          </Box>
          
          {/* Organization options */}
          {organizations.map((org, index) => (
            <Box key={org.id}>
              <Text>
                {cursor === index + 1
                  ? chalk.bgCyan.black(' → ') + ' ' + chalk.bold(org.name || org.login) + chalk.gray(` (@${org.login})`)
                  : '   ' + chalk.gray(org.name || org.login) + chalk.gray(` (@${org.login})`)}
              </Text>
            </Box>
          ))}
          
          {organizations.length === 0 && (
            <Text color="gray" dimColor>No organizations found</Text>
          )}
        </Box>
      )}
      
      <Box marginTop={2}>
        <Text color="gray">
          ↑/↓ Navigate • Enter Select • Esc Cancel
        </Text>
      </Box>
    </Box>
  );
}
