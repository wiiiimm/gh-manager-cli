#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
console.log('Token present:', token ? 'YES' : 'NO');
console.log('Token length:', token?.length);
console.log('Token prefix:', token?.substring(0, 10) + '...');

// Quick test of the token with GitHub API
if (token) {
  fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  })
  .then(res => {
    console.log('Response status:', res.status);
    if (res.status === 200) {
      return res.json();
    } else {
      throw new Error(`Status ${res.status}: ${res.statusText}`);
    }
  })
  .then(data => {
    console.log('✓ Token is valid!');
    console.log('User:', data.login);
  })
  .catch(err => {
    console.log('✗ Token validation failed:', err.message);
  });
}
