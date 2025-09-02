#!/usr/bin/env node

// Quick test to check if the app can connect to GitHub
import { makeClient, getViewerLogin, fetchViewerReposPageUnified } from './dist/github.js';

async function test() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  
  console.log('=== GitHub Connection Test ===');
  console.log('Token present:', token ? 'YES' : 'NO');
  console.log('Token length:', token?.length);
  console.log('Token prefix:', token?.substring(0, 10) + '...');
  
  if (!token) {
    console.error('ERROR: No GitHub token found!');
    console.log('\nPlease set either GITHUB_TOKEN or GH_TOKEN environment variable');
    process.exit(1);
  }
  
  try {
    console.log('\n1. Testing viewer login...');
    const client = makeClient(token);
    const login = await getViewerLogin(client);
    console.log('✓ Viewer login:', login);
    
    console.log('\n2. Testing repository fetch...');
    const repos = await fetchViewerReposPageUnified(
      token,
      5,  // first 5 repos
      null,  // no cursor
      { field: 'UPDATED_AT', direction: 'DESC' },
      true,  // include fork tracking
      'network-only'  // force network
    );
    
    console.log('✓ Fetched repos:', repos.nodes.length);
    console.log('✓ Total count:', repos.totalCount);
    console.log('✓ Has next page:', repos.hasNextPage);
    
    if (repos.rateLimit) {
      console.log('\nRate limit info:');
      console.log('  Remaining:', repos.rateLimit.remaining);
      console.log('  Limit:', repos.rateLimit.limit);
    }
    
    console.log('\n✅ All tests passed! GitHub connection is working.');
    
  } catch (error) {
    console.error('\n❌ Error connecting to GitHub:');
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    
    if (error.message?.includes('Bad credentials')) {
      console.error('\nYour token appears to be invalid or expired.');
      console.error('Please check your GitHub token.');
    } else if (error.message?.includes('rate limit')) {
      console.error('\nYou have hit the GitHub API rate limit.');
      console.error('Please wait and try again later.');
    } else {
      console.error('\nFull error:', error);
    }
    
    process.exit(1);
  }
}

test();