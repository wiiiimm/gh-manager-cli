import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { fetchViewerOrganizations, checkOrganizationIsEnterprise } from '../github';
import { openGitHubAuthorizationPage } from '../oauth';
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
  const [enterpriseOrgs, setEnterpriseOrgs] = useState<Set<string>>(new Set());
  const [showReauthorizeOption, setShowReauthorizeOption] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Determine if the current context is personal or an organization
  const isPersonalContext = currentContext === 'personal';
  
  // Function to load organisations
  const loadOrgs = async () => {
    try {
      setLoading(true);
      setError(null);
      const client = await import('../github').then(m => m.makeClient(token));
      const orgs = await fetchViewerOrganizations(client);
      setOrganizations(orgs);
      
      // Check which organisations are enterprise
      const entOrgs = new Set<string>();
      for (const org of orgs) {
        const isEnt = await checkOrganizationIsEnterprise(client, org.login);
        if (isEnt) {
          entOrgs.add(org.login);
        }
      }
      setEnterpriseOrgs(entOrgs);
      
      // Set initial cursor position based on current context
      if (!isPersonalContext) {
        const orgLogin = (currentContext as any).login;
        const index = orgs.findIndex(org => org.login === orgLogin);
        if (index !== -1) {
          setCursor(index + 1); // +1 because personal account is at index 0
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load organisations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load organisations on mount
  useEffect(() => {
    loadOrgs();
  }, []);
  
  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    
    // Handle R to refresh the organisation list
    if (input?.toLowerCase() === 'r' && !refreshing && !loading) {
      setRefreshing(true);
      loadOrgs();
      return;
    }
    
    // Handle Ctrl+W to manage GitHub session rights (W for Web/Who has access)
    if (key.ctrl && input === 'w') {
      // Don't close the modal, just open the browser
      // Use process.nextTick to defer execution
      process.nextTick(() => {
        openGitHubAuthorizationPage().catch(err => {
          // Show error but keep modal open
          setError('Failed to open GitHub authorisation page');
        });
      });
      // Important: return here to prevent any other handling
      return;
    }
    
    if (key.return) {
      if (cursor === 0) {
        // Personal account selected
        onSelect('personal');
      } else if (cursor <= organizations.length) {
        // Organisation selected
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
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={50}>
      <Text bold>Switch Account {refreshing && <Text color="yellow">(Refreshing...)</Text>}</Text>
      
      {loading && !refreshing ? (
        <Text color="yellow">Loading...</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {/* Personal account option */}
          <Box>
            <Text>
              {cursor === 0 
                ? chalk.bgCyan.black(' → ') + ' ' + chalk.bold('Personal Account') + 
                  (isPersonalContext ? chalk.green(' ✓') : '')
                : '   ' + chalk.gray('Personal Account') + 
                  (isPersonalContext ? chalk.green(' ✓') : '')}
            </Text>
          </Box>
          
          {/* Organisation options */}
          {organizations.map((org, index) => {
            const isEnterprise = enterpriseOrgs.has(org.login);
            const isCurrent = cursor === index + 1;
            const isActiveContext = !isPersonalContext && (currentContext as any).login === org.login;
            
            return (
              <Box key={org.id}>
                <Text>
                  {isCurrent
                    ? chalk.bgCyan.black(' → ') + ' ' + chalk.bold(org.name || org.login) + 
                      (isEnterprise ? chalk.yellow(' (ENT)') : '') +
                      chalk.gray(` (@${org.login})`) +
                      (isActiveContext ? chalk.green(' ✓') : '')
                    : '   ' + chalk.gray(org.name || org.login) + 
                      (isEnterprise ? chalk.gray(' (ENT)') : '') +
                      chalk.gray(` (@${org.login})`) +
                      (isActiveContext ? chalk.green(' ✓') : '')}
                </Text>
              </Box>
            );
          })}
          
          {organizations.length === 0 && (
            <Text color="gray" dimColor>No organisations found</Text>
          )}
        </Box>
      )}
      
      <Box marginTop={1} flexDirection="column">
        <Text color="gray" dimColor>
          ↑↓/Enter • R Refresh • Esc
        </Text>
        <Box height={1}><Text> </Text></Box>
        <Text color="cyan">
          Not seeing your organisations? Press <Text bold color="yellow">Ctrl+W</Text> to manage GitHub access
        </Text>
      </Box>
    </Box>
  );
}
