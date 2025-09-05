#!/usr/bin/env node

import https from 'https';

// Get token from environment
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  console.error('Error: GITHUB_TOKEN or GH_TOKEN environment variable is required');
  process.exit(1);
}

const orgLogin = 'altx-labs';

// Function to make GraphQL query
function graphqlQuery(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'gh-manager-cli-test'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testEnterpriseDetection() {
  console.log(`\nTesting enterprise detection for organization: ${orgLogin}\n`);
  
  // Test 1: Basic organization query
  console.log('Test 1: Basic organization info...');
  try {
    const query1 = `
      query CheckOrg($orgLogin: String!) {
        organization(login: $orgLogin) {
          login
          name
          description
          viewerCanCreateRepositories
          viewerIsAMember
        }
      }
    `;
    const result1 = await graphqlQuery(query1, { orgLogin });
    console.log('✓ Basic org info:', JSON.stringify(result1.data?.organization, null, 2));
  } catch (error) {
    console.log('✗ Basic org query failed:', error.message);
  }
  
  // Test 2: Try to query for INTERNAL repositories
  console.log('\nTest 2: Query for INTERNAL repositories...');
  try {
    const query2 = `
      query CheckInternalRepos($orgLogin: String!) {
        organization(login: $orgLogin) {
          repositories(first: 1, privacy: INTERNAL) {
            totalCount
            nodes {
              name
              visibility
            }
          }
        }
      }
    `;
    const result2 = await graphqlQuery(query2, { orgLogin });
    if (result2.errors) {
      console.log('✗ INTERNAL query returned errors:', JSON.stringify(result2.errors, null, 2));
      console.log('  → This suggests the org is NOT enterprise');
    } else {
      console.log('✓ INTERNAL query succeeded:', JSON.stringify(result2.data?.organization?.repositories, null, 2));
      console.log('  → This suggests the org IS enterprise');
    }
  } catch (error) {
    console.log('✗ INTERNAL query failed:', error.message);
  }
  
  // Test 3: Check all repository visibilities
  console.log('\nTest 3: Check all repository visibilities in org...');
  try {
    const query3 = `
      query CheckAllRepos($orgLogin: String!) {
        organization(login: $orgLogin) {
          repositories(first: 100) {
            totalCount
            nodes {
              name
              visibility
              isPrivate
            }
          }
        }
      }
    `;
    const result3 = await graphqlQuery(query3, { orgLogin });
    if (result3.data?.organization?.repositories?.nodes) {
      const repos = result3.data.organization.repositories.nodes;
      const visibilities = {};
      repos.forEach(repo => {
        visibilities[repo.visibility] = (visibilities[repo.visibility] || 0) + 1;
      });
      console.log('✓ Repository visibility breakdown:', visibilities);
      console.log('  Total repos:', result3.data.organization.repositories.totalCount);
      
      // Check if any are INTERNAL
      if (visibilities.INTERNAL) {
        console.log('  → Found INTERNAL repos - org IS enterprise!');
      }
    }
  } catch (error) {
    console.log('✗ All repos query failed:', error.message);
  }
  
  // Test 4: Try GitHub Enterprise-specific fields
  console.log('\nTest 4: Check enterprise-specific fields...');
  try {
    const query4 = `
      query CheckEnterpriseFields($orgLogin: String!) {
        organization(login: $orgLogin) {
          login
          __typename
        }
      }
    `;
    const result4 = await graphqlQuery(query4, { orgLogin });
    console.log('✓ Type info:', JSON.stringify(result4.data?.organization, null, 2));
  } catch (error) {
    console.log('✗ Enterprise fields query failed:', error.message);
  }
  
  // Test 5: Check if we can create a repo with INTERNAL visibility (dry run)
  console.log('\nTest 5: Check available repository visibility options...');
  try {
    // This is a different approach - check the schema/capabilities
    const query5 = `
      query CheckOrgCapabilities($orgLogin: String!) {
        organization(login: $orgLogin) {
          viewerCanCreateRepositories
          repositories(first: 1, privacy: PUBLIC) {
            totalCount
          }
        }
      }
    `;
    const result5 = await graphqlQuery(query5, { orgLogin });
    console.log('✓ Can create repos:', result5.data?.organization?.viewerCanCreateRepositories);
    
    // Now try each privacy option
    const privacyOptions = ['PUBLIC', 'PRIVATE', 'INTERNAL'];
    for (const privacy of privacyOptions) {
      try {
        const testQuery = `
          query TestPrivacy($orgLogin: String!) {
            organization(login: $orgLogin) {
              repositories(first: 1, privacy: ${privacy}) {
                totalCount
              }
            }
          }
        `;
        const testResult = await graphqlQuery(testQuery, { orgLogin });
        if (testResult.errors) {
          console.log(`  ✗ ${privacy}: Not supported (${testResult.errors[0].message})`);
        } else {
          console.log(`  ✓ ${privacy}: Supported (found ${testResult.data?.organization?.repositories?.totalCount || 0} repos)`);
        }
      } catch (e) {
        console.log(`  ✗ ${privacy}: Query failed`);
      }
    }
  } catch (error) {
    console.log('✗ Capabilities query failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('If INTERNAL privacy queries succeed without errors, the org is enterprise.');
  console.log('If they return errors about invalid privacy values, it\'s not enterprise.');
  console.log('='.repeat(60) + '\n');
}

// Run the tests
testEnterpriseDetection().catch(console.error);