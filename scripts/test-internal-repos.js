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

async function findInternalRepos() {
  console.log(`\nSearching for INTERNAL repositories in ${orgLogin}...\n`);
  
  // Test 1: Get ALL repos and check their visibility field
  console.log('Test 1: Fetching all repositories and checking visibility field...');
  try {
    let hasNextPage = true;
    let cursor = null;
    let allRepos = [];
    let page = 1;
    
    while (hasNextPage) {
      const query = `
        query GetAllRepos($orgLogin: String!, $cursor: String) {
          organization(login: $orgLogin) {
            repositories(first: 100, after: $cursor) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                name
                nameWithOwner
                visibility
                isPrivate
                isPublic
                isInternal
              }
            }
          }
        }
      `;
      
      console.log(`  Fetching page ${page}...`);
      const result = await graphqlQuery(query, { orgLogin, cursor });
      
      if (result.errors) {
        console.log('  Errors:', result.errors);
        // Try without isInternal field if it fails
        console.log('\n  Retrying without isInternal field...');
        const queryWithoutInternal = `
          query GetAllRepos($orgLogin: String!, $cursor: String) {
            organization(login: $orgLogin) {
              repositories(first: 100, after: $cursor) {
                totalCount
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  name
                  nameWithOwner
                  visibility
                  isPrivate
                  isPublic
                }
              }
            }
          }
        `;
        const retryResult = await graphqlQuery(queryWithoutInternal, { orgLogin, cursor });
        if (retryResult.data?.organization?.repositories) {
          const repos = retryResult.data.organization.repositories.nodes;
          allRepos.push(...repos);
          hasNextPage = retryResult.data.organization.repositories.pageInfo.hasNextPage;
          cursor = retryResult.data.organization.repositories.pageInfo.endCursor;
        } else {
          break;
        }
      } else if (result.data?.organization?.repositories) {
        const repos = result.data.organization.repositories.nodes;
        allRepos.push(...repos);
        hasNextPage = result.data.organization.repositories.pageInfo.hasNextPage;
        cursor = result.data.organization.repositories.pageInfo.endCursor;
      } else {
        break;
      }
      page++;
    }
    
    console.log(`\n✓ Fetched ${allRepos.length} repositories total\n`);
    
    // Analyze visibility
    const visibilityCount = {};
    const internalRepos = [];
    
    allRepos.forEach(repo => {
      const vis = repo.visibility || (repo.isPrivate ? 'PRIVATE' : 'PUBLIC');
      visibilityCount[vis] = (visibilityCount[vis] || 0) + 1;
      
      if (vis === 'INTERNAL' || repo.isInternal) {
        internalRepos.push(repo);
      }
    });
    
    console.log('Visibility breakdown:', visibilityCount);
    
    if (internalRepos.length > 0) {
      console.log(`\n🎉 Found ${internalRepos.length} INTERNAL repositories:`);
      internalRepos.forEach(repo => {
        console.log(`  - ${repo.nameWithOwner} (visibility: ${repo.visibility})`);
      });
    } else {
      console.log('\n❌ No INTERNAL repositories found');
    }
    
  } catch (error) {
    console.log('✗ Failed to fetch repos:', error.message);
  }
  
  // Test 2: Try different query approaches
  console.log('\n\nTest 2: Testing different visibility query approaches...');
  
  // Approach 1: Without privacy filter
  try {
    const query1 = `
      query {
        organization(login: "${orgLogin}") {
          repositories(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              name
              visibility
            }
          }
        }
      }
    `;
    const result1 = await graphqlQuery(query1);
    console.log('✓ Recent repos visibility:', 
      result1.data?.organization?.repositories?.nodes?.map(r => `${r.name}: ${r.visibility}`).join(', '));
  } catch (error) {
    console.log('✗ Query failed:', error.message);
  }
  
  // Test 3: Check token scopes
  console.log('\n\nTest 3: Checking token permissions...');
  try {
    const query3 = `
      query {
        viewer {
          login
          organizations(first: 10) {
            nodes {
              login
              viewerCanAdminister
              viewerCanCreateRepositories
              viewerIsAMember
            }
          }
        }
      }
    `;
    const result3 = await graphqlQuery(query3);
    const org = result3.data?.viewer?.organizations?.nodes?.find(o => o.login === orgLogin);
    if (org) {
      console.log(`✓ Your permissions in ${orgLogin}:`);
      console.log(`  - Is member: ${org.viewerIsAMember}`);
      console.log(`  - Can create repos: ${org.viewerCanCreateRepositories}`);
      console.log(`  - Can administer: ${org.viewerCanAdminister}`);
    } else {
      console.log(`✗ Organization ${orgLogin} not found in your organizations`);
    }
  } catch (error) {
    console.log('✗ Permission check failed:', error.message);
  }
  
  // Test 4: Search for repos with internal in name (in case visibility field isn't working)
  console.log('\n\nTest 4: Searching for repos with "internal" in name/description...');
  try {
    const query4 = `
      query {
        search(query: "org:${orgLogin} internal", type: REPOSITORY, first: 10) {
          repositoryCount
          nodes {
            ... on Repository {
              nameWithOwner
              visibility
              description
            }
          }
        }
      }
    `;
    const result4 = await graphqlQuery(query4);
    if (result4.data?.search?.nodes?.length > 0) {
      console.log(`✓ Found ${result4.data.search.repositoryCount} repos mentioning "internal":`);
      result4.data.search.nodes.forEach(repo => {
        console.log(`  - ${repo.nameWithOwner}: visibility=${repo.visibility}`);
      });
    } else {
      console.log('✗ No repos found with "internal" in name/description');
    }
  } catch (error) {
    console.log('✗ Search failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('- Check if any repos show visibility: "INTERNAL" above');
  console.log('- If you see INTERNAL repos on website but not here, it could be:');
  console.log('  1. Token permission issue (need full repo scope)');
  console.log('  2. API access level difference');
  console.log('  3. Enterprise features not fully propagated to API');
  console.log('='.repeat(60) + '\n');
}

// Run the tests
findInternalRepos().catch(console.error);